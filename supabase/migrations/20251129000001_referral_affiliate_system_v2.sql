-- =====================================================
-- 聯盟行銷與好友推薦系統 V2
-- 完全重建，支援分級佣金和終身佣金
-- =====================================================

-- =====================================================
-- 1. 移除舊的聯盟系統表格
-- =====================================================
DROP TABLE IF EXISTS affiliate_tracking_logs CASCADE;
DROP TABLE IF EXISTS affiliate_withdrawals CASCADE;
DROP TABLE IF EXISTS affiliate_commissions CASCADE;
DROP TABLE IF EXISTS affiliate_referrals CASCADE;
DROP TABLE IF EXISTS affiliates CASCADE;
DROP TABLE IF EXISTS resellers CASCADE;
DROP TABLE IF EXISTS commissions CASCADE;
DROP TABLE IF EXISTS company_referral_codes CASCADE;
DROP TABLE IF EXISTS referral_rewards CASCADE;

-- 移除舊的函數
DROP FUNCTION IF EXISTS generate_affiliate_code() CASCADE;
DROP FUNCTION IF EXISTS check_inactive_affiliates() CASCADE;
DROP FUNCTION IF EXISTS unlock_commissions() CASCADE;
DROP FUNCTION IF EXISTS award_referral_bonus() CASCADE;

-- =====================================================
-- 2. 推薦碼表（所有用戶通用）
-- =====================================================
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  code VARCHAR(10) UNIQUE NOT NULL,
  total_clicks INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referral_codes_company ON referral_codes(company_id);
CREATE INDEX idx_referral_codes_code ON referral_codes(code);

COMMENT ON TABLE referral_codes IS '推薦碼表（所有用戶通用）';

-- =====================================================
-- 3. 推薦關係表
-- =====================================================
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  referred_company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  referral_code VARCHAR(10) NOT NULL,

  -- 狀態
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  first_payment_at TIMESTAMPTZ,
  first_payment_amount DECIMAL(10,2),

  -- 獎勵類型（根據推薦人身份決定）
  reward_type VARCHAR(20) CHECK (reward_type IN ('tokens', 'commission')),
  tokens_rewarded INTEGER DEFAULT 0,

  -- 終身價值追蹤
  total_payments INTEGER DEFAULT 0,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  total_commission_generated DECIMAL(10,2) DEFAULT 0,
  last_payment_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_company_id);
CREATE INDEX idx_referrals_referred ON referrals(referred_company_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referrals_status ON referrals(status);

COMMENT ON TABLE referrals IS '推薦關係表';

-- =====================================================
-- 4. 佣金等級配置表
-- =====================================================
CREATE TABLE affiliate_tiers (
  id SERIAL PRIMARY KEY,
  tier_level INTEGER UNIQUE NOT NULL,
  tier_name VARCHAR(20) NOT NULL,
  tier_name_en VARCHAR(20) NOT NULL,
  min_referrals INTEGER NOT NULL,
  max_referrals INTEGER,
  commission_rate DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO affiliate_tiers (tier_level, tier_name, tier_name_en, min_referrals, max_referrals, commission_rate) VALUES
(1, '銅牌', 'Bronze', 0, 5, 15.00),
(2, '銀牌', 'Silver', 6, 15, 20.00),
(3, '金牌', 'Gold', 16, 30, 25.00),
(4, '白金', 'Platinum', 31, NULL, 30.00);

COMMENT ON TABLE affiliate_tiers IS '佣金等級配置表';

-- =====================================================
-- 5. 聯盟夥伴表
-- =====================================================
CREATE TABLE affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

  -- 基本資料
  full_name VARCHAR(100) NOT NULL,
  id_number VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT,

  -- 銀行帳戶
  bank_code VARCHAR(10),
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30),
  bank_account_name VARCHAR(100),

  -- 稅務
  is_resident BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 10.00,

  -- 分級佣金
  current_tier INTEGER DEFAULT 1 REFERENCES affiliate_tiers(tier_level),
  qualified_referrals INTEGER DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 15.00,

  -- 佣金餘額
  pending_commission DECIMAL(10,2) DEFAULT 0,
  available_commission DECIMAL(10,2) DEFAULT 0,
  withdrawn_commission DECIMAL(10,2) DEFAULT 0,
  lifetime_commission DECIMAL(10,2) DEFAULT 0,

  -- 狀態
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'terminated')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_affiliates_company ON affiliates(company_id);
CREATE INDEX idx_affiliates_status ON affiliates(status);
CREATE INDEX idx_affiliates_tier ON affiliates(current_tier);

COMMENT ON TABLE affiliates IS '聯盟夥伴表';

-- =====================================================
-- 6. 佣金記錄表
-- =====================================================
CREATE TABLE affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  payment_order_id UUID REFERENCES payment_orders(id),

  -- 訂單資訊
  order_amount DECIMAL(10,2) NOT NULL,
  order_type VARCHAR(30) NOT NULL,

  -- 佣金計算（記錄當時等級）
  tier_level INTEGER NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,

  -- 稅務
  tax_rate DECIMAL(5,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  net_commission DECIMAL(10,2) NOT NULL,

  -- 鎖定期
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  unlock_at TIMESTAMPTZ NOT NULL,

  -- 狀態
  status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'withdrawn', 'cancelled')),

  -- 提領關聯
  withdrawal_id UUID,
  withdrawn_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commissions_affiliate ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_commissions_referral ON affiliate_commissions(referral_id);
CREATE INDEX idx_commissions_status ON affiliate_commissions(status);
CREATE INDEX idx_commissions_unlock ON affiliate_commissions(unlock_at);

COMMENT ON TABLE affiliate_commissions IS '佣金記錄表';

-- =====================================================
-- 7. 提領申請表
-- =====================================================
CREATE TABLE affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,

  -- 金額
  withdrawal_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,

  -- 銀行資訊快照
  bank_code VARCHAR(10) NOT NULL,
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30) NOT NULL,
  bank_account_name VARCHAR(100) NOT NULL,

  -- 審核狀態
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'processing', 'completed', 'rejected', 'cancelled')),

  -- 審核資訊
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,

  -- 撥款資訊
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 佣金明細
  commission_ids JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_affiliate ON affiliate_withdrawals(affiliate_id);
CREATE INDEX idx_withdrawals_status ON affiliate_withdrawals(status);

COMMENT ON TABLE affiliate_withdrawals IS '提領申請表';

-- =====================================================
-- 8. Token 獎勵記錄表
-- =====================================================
CREATE TABLE referral_token_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,

  -- 推薦人獎勵
  referrer_company_id UUID NOT NULL REFERENCES companies(id),
  referrer_tokens INTEGER NOT NULL DEFAULT 10000,
  referrer_credited_at TIMESTAMPTZ,

  -- 被推薦人獎勵
  referred_company_id UUID NOT NULL REFERENCES companies(id),
  referred_tokens INTEGER NOT NULL DEFAULT 10000,
  referred_credited_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_rewards_referral ON referral_token_rewards(referral_id);
CREATE INDEX idx_token_rewards_referrer ON referral_token_rewards(referrer_company_id);

COMMENT ON TABLE referral_token_rewards IS 'Token 獎勵記錄表';

-- =====================================================
-- 9. 推薦追蹤日誌表
-- =====================================================
CREATE TABLE referral_tracking_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code VARCHAR(10) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('click', 'register', 'payment')),

  -- 訪客資訊
  session_id VARCHAR(100),
  ip_address VARCHAR(50),
  user_agent TEXT,
  referer TEXT,
  landing_page TEXT,

  -- 關聯資料
  company_id UUID REFERENCES companies(id),

  -- 額外資訊
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_code ON referral_tracking_logs(referral_code);
CREATE INDEX idx_tracking_event ON referral_tracking_logs(event_type);
CREATE INDEX idx_tracking_created ON referral_tracking_logs(created_at);

COMMENT ON TABLE referral_tracking_logs IS '推薦追蹤日誌表';

-- =====================================================
-- 10. 等級變動歷史表
-- =====================================================
CREATE TABLE affiliate_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  previous_tier INTEGER,
  new_tier INTEGER NOT NULL,
  previous_rate DECIMAL(5,2),
  new_rate DECIMAL(5,2) NOT NULL,
  qualified_referrals INTEGER NOT NULL,
  trigger_reason VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tier_history_affiliate ON affiliate_tier_history(affiliate_id);

COMMENT ON TABLE affiliate_tier_history IS '等級變動歷史表';

-- =====================================================
-- 11. 觸發器：自動更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 12. 推薦碼生成函數
-- =====================================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code VARCHAR(10);
  code_exists BOOLEAN;
  i INTEGER;
BEGIN
  LOOP
    new_code := '';
    FOR i IN 1..8 LOOP
      new_code := new_code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    SELECT EXISTS(SELECT 1 FROM referral_codes WHERE code = new_code) INTO code_exists;

    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 13. 自動解鎖佣金函數
-- =====================================================
CREATE OR REPLACE FUNCTION unlock_affiliate_commissions()
RETURNS void AS $$
BEGIN
  UPDATE affiliate_commissions
  SET status = 'available'
  WHERE status = 'locked' AND unlock_at <= NOW();

  UPDATE affiliates a
  SET
    pending_commission = COALESCE((
      SELECT SUM(net_commission)
      FROM affiliate_commissions
      WHERE affiliate_id = a.id AND status = 'locked'
    ), 0),
    available_commission = COALESCE((
      SELECT SUM(net_commission)
      FROM affiliate_commissions
      WHERE affiliate_id = a.id AND status = 'available'
    ), 0);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 14. 更新聯盟夥伴等級函數
-- =====================================================
CREATE OR REPLACE FUNCTION update_affiliate_tier(p_affiliate_id UUID)
RETURNS void AS $$
DECLARE
  v_qualified_count INTEGER;
  v_current_tier INTEGER;
  v_current_rate DECIMAL(5,2);
  v_new_tier RECORD;
BEGIN
  SELECT current_tier, commission_rate INTO v_current_tier, v_current_rate
  FROM affiliates WHERE id = p_affiliate_id;

  SELECT COUNT(*) INTO v_qualified_count
  FROM referrals r
  WHERE r.referrer_company_id = (SELECT company_id FROM affiliates WHERE id = p_affiliate_id)
    AND r.reward_type = 'commission'
    AND r.first_payment_at IS NOT NULL;

  SELECT * INTO v_new_tier
  FROM affiliate_tiers
  WHERE min_referrals <= v_qualified_count
    AND (max_referrals IS NULL OR max_referrals >= v_qualified_count)
  ORDER BY tier_level DESC
  LIMIT 1;

  IF v_new_tier.tier_level != v_current_tier THEN
    UPDATE affiliates
    SET
      current_tier = v_new_tier.tier_level,
      commission_rate = v_new_tier.commission_rate,
      qualified_referrals = v_qualified_count
    WHERE id = p_affiliate_id;

    INSERT INTO affiliate_tier_history (
      affiliate_id, previous_tier, new_tier, previous_rate, new_rate,
      qualified_referrals, trigger_reason
    ) VALUES (
      p_affiliate_id, v_current_tier, v_new_tier.tier_level,
      v_current_rate, v_new_tier.commission_rate,
      v_qualified_count, 'referral_qualified'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 15. 啟用 RLS
-- =====================================================
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_token_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_tracking_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_tier_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 16. RLS 政策
-- =====================================================

-- referral_codes: 用戶可以查看自己的推薦碼
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- referrals: 推薦人可以查看自己的推薦關係
CREATE POLICY "Users can view own referrals"
  ON referrals FOR SELECT
  USING (referrer_company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- affiliates: 用戶可以查看自己的聯盟夥伴資料
CREATE POLICY "Users can view own affiliate"
  ON affiliates FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- affiliate_commissions: 聯盟夥伴可以查看自己的佣金
CREATE POLICY "Affiliates can view own commissions"
  ON affiliate_commissions FOR SELECT
  USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

-- affiliate_withdrawals: 聯盟夥伴可以查看自己的提領記錄
CREATE POLICY "Affiliates can view own withdrawals"
  ON affiliate_withdrawals FOR SELECT
  USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

-- referral_token_rewards: 用戶可以查看自己的獎勵記錄
CREATE POLICY "Users can view own token rewards"
  ON referral_token_rewards FOR SELECT
  USING (
    referrer_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    ) OR
    referred_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- Service role 完整存取
CREATE POLICY "Service role full access referral_codes"
  ON referral_codes FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access referrals"
  ON referrals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access affiliates"
  ON affiliates FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access commissions"
  ON affiliate_commissions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access withdrawals"
  ON affiliate_withdrawals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access token_rewards"
  ON referral_token_rewards FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access tracking_logs"
  ON referral_tracking_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access tier_history"
  ON affiliate_tier_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 17. 為 companies 表新增推薦碼欄位
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'referred_by_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN referred_by_code VARCHAR(10);
    CREATE INDEX idx_companies_referred_by ON companies(referred_by_code);
  END IF;
END $$;

-- =====================================================
-- 完成提示
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ 聯盟行銷與好友推薦系統 V2 Migration 執行成功！';
  RAISE NOTICE '';
  RAISE NOTICE '已創建的資料表：';
  RAISE NOTICE '  - referral_codes (推薦碼)';
  RAISE NOTICE '  - referrals (推薦關係)';
  RAISE NOTICE '  - affiliate_tiers (佣金等級配置)';
  RAISE NOTICE '  - affiliates (聯盟夥伴)';
  RAISE NOTICE '  - affiliate_commissions (佣金記錄)';
  RAISE NOTICE '  - affiliate_withdrawals (提領申請)';
  RAISE NOTICE '  - referral_token_rewards (Token 獎勵)';
  RAISE NOTICE '  - referral_tracking_logs (追蹤日誌)';
  RAISE NOTICE '  - affiliate_tier_history (等級變動歷史)';
  RAISE NOTICE '';
  RAISE NOTICE '分級佣金配置：';
  RAISE NOTICE '  - 銅牌 (0-5人): 15%';
  RAISE NOTICE '  - 銀牌 (6-15人): 20%';
  RAISE NOTICE '  - 金牌 (16-30人): 25%';
  RAISE NOTICE '  - 白金 (31+人): 30%';
END $$;
