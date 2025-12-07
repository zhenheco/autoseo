-- =====================================================
-- 推薦系統反詐騙機制
-- 裝置指紋偵測、可疑行為標記
-- =====================================================

-- =====================================================
-- 1. 裝置指紋表
-- =====================================================
CREATE TABLE IF NOT EXISTS device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_hash VARCHAR(64) NOT NULL,
  fingerprint_components JSONB,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_accounts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_fingerprints_hash
  ON device_fingerprints(fingerprint_hash);

COMMENT ON TABLE device_fingerprints IS '裝置指紋表 - 儲存 ThumbmarkJS 收集的指紋';

-- =====================================================
-- 2. 裝置指紋與帳號關聯表
-- =====================================================
CREATE TABLE IF NOT EXISTS device_fingerprint_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint_id UUID NOT NULL REFERENCES device_fingerprints(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(fingerprint_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_fingerprint_accounts_fingerprint
  ON device_fingerprint_accounts(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_fingerprint_accounts_company
  ON device_fingerprint_accounts(company_id);

COMMENT ON TABLE device_fingerprint_accounts IS '裝置指紋與帳號關聯表';

-- =====================================================
-- 3. 可疑推薦記錄表
-- =====================================================
CREATE TABLE IF NOT EXISTS suspicious_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  referrer_company_id UUID NOT NULL REFERENCES companies(id),
  referred_company_id UUID REFERENCES companies(id),

  -- 可疑類型
  suspicion_type VARCHAR(50) NOT NULL CHECK (suspicion_type IN (
    'same_device',       -- 同裝置多帳號
    'referral_loop',     -- 推薦環路 (A->B->C->A)
    'rapid_referrals',   -- 短時間大量推薦
    'quick_cancel'       -- 推薦後快速取消訂閱
  )),

  -- 嚴重程度
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN (
    'low',      -- 2 個帳號同裝置
    'medium',   -- 3-4 個帳號同裝置 或 一般可疑模式
    'high',     -- 5+ 個帳號同裝置 或 嚴重可疑模式
    'critical'  -- 同裝置且在推薦鏈中
  )),

  -- 證據 (JSON 格式)
  evidence JSONB NOT NULL,

  -- 審核狀態
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',         -- 待審核
    'reviewing',       -- 審核中
    'confirmed_fraud', -- 確認詐騙
    'false_positive',  -- 誤判（正常）
    'dismissed'        -- 已忽略
  )),

  -- 審核資訊
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- 採取的行動
  action_taken VARCHAR(50) CHECK (action_taken IN (
    'none',              -- 無
    'reward_cancelled',  -- 取消獎勵
    'account_suspended', -- 帳號暫停
    'account_terminated' -- 帳號終止
  )),
  action_taken_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suspicious_referrals_status
  ON suspicious_referrals(status);
CREATE INDEX IF NOT EXISTS idx_suspicious_referrals_type
  ON suspicious_referrals(suspicion_type);
CREATE INDEX IF NOT EXISTS idx_suspicious_referrals_severity
  ON suspicious_referrals(severity);
CREATE INDEX IF NOT EXISTS idx_suspicious_referrals_referrer
  ON suspicious_referrals(referrer_company_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_referrals_referred
  ON suspicious_referrals(referred_company_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_referrals_created
  ON suspicious_referrals(created_at);

COMMENT ON TABLE suspicious_referrals IS '可疑推薦記錄表 - 標記可疑行為供管理員審核';

-- =====================================================
-- 4. 擴展 referral_tracking_logs 表
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_tracking_logs'
    AND column_name = 'device_fingerprint'
  ) THEN
    ALTER TABLE referral_tracking_logs
    ADD COLUMN device_fingerprint VARCHAR(64);

    CREATE INDEX idx_tracking_fingerprint
      ON referral_tracking_logs(device_fingerprint);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'referral_tracking_logs'
    AND column_name = 'fingerprint_id'
  ) THEN
    ALTER TABLE referral_tracking_logs
    ADD COLUMN fingerprint_id UUID REFERENCES device_fingerprints(id);
  END IF;
END $$;

-- =====================================================
-- 5. 觸發器：自動更新 updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_suspicious_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_suspicious_referrals_updated_at ON suspicious_referrals;
CREATE TRIGGER update_suspicious_referrals_updated_at
  BEFORE UPDATE ON suspicious_referrals
  FOR EACH ROW EXECUTE FUNCTION update_suspicious_referrals_updated_at();

-- =====================================================
-- 6. 推薦環路偵測函數
-- =====================================================
CREATE OR REPLACE FUNCTION check_referral_loop(
  p_referrer_company_id UUID,
  p_referred_company_id UUID,
  p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
  is_loop BOOLEAN,
  loop_chain UUID[],
  loop_length INTEGER
) AS $$
DECLARE
  v_chain UUID[];
  v_found BOOLEAN := FALSE;
BEGIN
  -- 使用遞迴 CTE 追蹤推薦鏈
  WITH RECURSIVE referral_chain AS (
    -- 起點：被推薦人
    SELECT
      r.referred_company_id,
      r.referrer_company_id,
      1 as depth,
      ARRAY[r.referred_company_id] as path
    FROM referrals r
    WHERE r.referred_company_id = p_referred_company_id

    UNION ALL

    -- 遞迴：往上追蹤推薦者
    SELECT
      r.referred_company_id,
      r.referrer_company_id,
      rc.depth + 1,
      rc.path || r.referred_company_id
    FROM referrals r
    JOIN referral_chain rc ON r.referred_company_id = rc.referrer_company_id
    WHERE rc.depth < p_max_depth
      AND NOT r.referred_company_id = ANY(rc.path) -- 防止無限迴圈
  )
  SELECT
    TRUE,
    path || p_referrer_company_id,
    depth + 1
  INTO v_found, v_chain, loop_length
  FROM referral_chain
  WHERE referrer_company_id = p_referrer_company_id
  LIMIT 1;

  IF v_found THEN
    RETURN QUERY SELECT TRUE, v_chain, loop_length;
  ELSE
    RETURN QUERY SELECT FALSE, ARRAY[]::UUID[], 0;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_referral_loop IS '檢查推薦環路 (A->B->C->A)';

-- =====================================================
-- 7. 同裝置帳號數查詢函數
-- =====================================================
CREATE OR REPLACE FUNCTION get_same_device_accounts(
  p_fingerprint_hash VARCHAR(64)
)
RETURNS TABLE (
  account_count INTEGER,
  company_ids UUID[],
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(dfa.company_id)::INTEGER as account_count,
    ARRAY_AGG(dfa.company_id) as company_ids,
    MIN(dfa.first_seen_at) as first_seen_at,
    MAX(dfa.last_seen_at) as last_seen_at
  FROM device_fingerprints df
  JOIN device_fingerprint_accounts dfa ON df.id = dfa.fingerprint_id
  WHERE df.fingerprint_hash = p_fingerprint_hash
  GROUP BY df.id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_same_device_accounts IS '查詢同裝置的所有帳號';

-- =====================================================
-- 8. RLS 政策
-- =====================================================
ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_fingerprint_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suspicious_referrals ENABLE ROW LEVEL SECURITY;

-- Service role 完整存取
CREATE POLICY "Service role full access device_fingerprints"
  ON device_fingerprints FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access device_fingerprint_accounts"
  ON device_fingerprint_accounts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access suspicious_referrals"
  ON suspicious_referrals FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 完成提示
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '推薦系統反詐騙機制 Migration 執行成功！';
  RAISE NOTICE '=====================================================';
  RAISE NOTICE '';
  RAISE NOTICE '已創建的資料表：';
  RAISE NOTICE '  - device_fingerprints (裝置指紋)';
  RAISE NOTICE '  - device_fingerprint_accounts (指紋-帳號關聯)';
  RAISE NOTICE '  - suspicious_referrals (可疑推薦記錄)';
  RAISE NOTICE '';
  RAISE NOTICE '已擴展的資料表：';
  RAISE NOTICE '  - referral_tracking_logs (新增 device_fingerprint, fingerprint_id)';
  RAISE NOTICE '';
  RAISE NOTICE '已創建的函數：';
  RAISE NOTICE '  - check_referral_loop() - 推薦環路偵測';
  RAISE NOTICE '  - get_same_device_accounts() - 同裝置帳號查詢';
  RAISE NOTICE '';
  RAISE NOTICE '偵測類型：';
  RAISE NOTICE '  - same_device: 同裝置多帳號';
  RAISE NOTICE '  - referral_loop: 推薦環路 (A->B->C->A)';
  RAISE NOTICE '  - rapid_referrals: 短時間大量推薦';
  RAISE NOTICE '  - quick_cancel: 推薦後快速取消';
  RAISE NOTICE '=====================================================';
END $$;
