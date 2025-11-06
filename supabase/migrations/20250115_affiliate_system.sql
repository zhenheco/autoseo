-- =====================================================
-- 聯盟行銷系統資料表
-- =====================================================

-- 1. 聯盟夥伴主表
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 推薦碼（唯一）
  affiliate_code VARCHAR(20) UNIQUE NOT NULL,

  -- 基本資料
  full_name VARCHAR(100) NOT NULL,
  id_number VARCHAR(20) NOT NULL, -- 身份證字號或統一編號
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,

  -- 銀行帳戶資訊
  bank_code VARCHAR(10), -- 銀行代碼（例如：012 = 台北富邦）
  bank_branch VARCHAR(100), -- 分行名稱
  bank_account VARCHAR(30), -- 帳號
  bank_account_name VARCHAR(100), -- 戶名

  -- 稅務資訊
  is_resident BOOLEAN DEFAULT true, -- 是否為境內居住者
  tax_rate DECIMAL(5,2) DEFAULT 10.00, -- 扣繳稅率 (10% 或 20%)
  tax_id_verified BOOLEAN DEFAULT false, -- 是否已驗證稅籍

  -- 證件上傳（JSON 存儲多個檔案路徑）
  id_document_url TEXT, -- 身份證/護照
  bank_document_url TEXT, -- 銀行存摺封面
  tax_document_url TEXT, -- 稅務文件
  documents_verified BOOLEAN DEFAULT false, -- 證件是否已驗證
  documents_verified_at TIMESTAMPTZ,

  -- 佣金統計
  total_referrals INTEGER DEFAULT 0, -- 總推薦人數
  active_referrals INTEGER DEFAULT 0, -- 活躍推薦人數
  pending_commission DECIMAL(10,2) DEFAULT 0, -- 待提領佣金
  locked_commission DECIMAL(10,2) DEFAULT 0, -- 鎖定期佣金（30天內）
  withdrawn_commission DECIMAL(10,2) DEFAULT 0, -- 已提領佣金
  lifetime_commission DECIMAL(10,2) DEFAULT 0, -- 終身累計佣金

  -- 活躍狀態追蹤
  last_referral_at TIMESTAMPTZ, -- 最後一次推薦時間
  last_active_payment_at TIMESTAMPTZ, -- 最後一次產生佣金的付款時間
  inactive_since TIMESTAMPTZ, -- 進入不活躍狀態的時間

  -- 狀態
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'terminated')),
  -- active: 正常運作
  -- inactive: 超過 3 個月無新客戶（自動設定）
  -- suspended: 管理員暫停
  -- terminated: 終止合作

  -- 審核資訊
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- 備註
  notes TEXT,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_affiliates_company_id ON affiliates(company_id);
CREATE INDEX idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX idx_affiliates_status ON affiliates(status);
CREATE INDEX idx_affiliates_last_active ON affiliates(last_active_payment_at);

-- =====================================================
-- 2. 推薦記錄表
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  affiliate_code VARCHAR(20) NOT NULL,

  -- 追蹤資訊
  referral_source VARCHAR(50), -- 'link', 'qr_code', 'manual'
  user_agent TEXT,
  ip_address INET,

  -- 轉換追蹤
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  first_payment_at TIMESTAMPTZ, -- 首次付款時間
  first_payment_amount DECIMAL(10,2), -- 首次付款金額

  -- 生命週期價值
  total_payments INTEGER DEFAULT 0, -- 總付款次數
  lifetime_value DECIMAL(10,2) DEFAULT 0, -- 客戶終身價值
  total_commission_generated DECIMAL(10,2) DEFAULT 0, -- 總計產生的佣金

  -- 活躍狀態
  last_payment_at TIMESTAMPTZ, -- 最後一次付款時間
  is_active BOOLEAN DEFAULT true, -- 客戶是否仍在訂閱
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX idx_referrals_company_id ON affiliate_referrals(referred_company_id);
CREATE INDEX idx_referrals_code ON affiliate_referrals(affiliate_code);
CREATE INDEX idx_referrals_first_payment ON affiliate_referrals(first_payment_at);

-- =====================================================
-- 3. 佣金記錄表
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,

  -- 訂單關聯
  payment_order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  mandate_id UUID REFERENCES recurring_mandates(id) ON DELETE SET NULL,

  -- 訂單資訊
  order_amount DECIMAL(10,2) NOT NULL, -- 訂單金額
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00, -- 佣金比例
  commission_amount DECIMAL(10,2) NOT NULL, -- 佣金金額

  -- 扣繳稅款
  tax_rate DECIMAL(5,2) NOT NULL, -- 扣繳稅率
  tax_amount DECIMAL(10,2) NOT NULL, -- 扣繳金額
  net_commission DECIMAL(10,2) NOT NULL, -- 實際可提領金額（扣稅後）

  -- 鎖定期管理（30天）
  earned_at TIMESTAMPTZ NOT NULL, -- 賺取時間（訂單付款時間）
  unlock_at TIMESTAMPTZ NOT NULL, -- 解鎖時間（earned_at + 30天）

  -- 狀態
  status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'withdrawn', 'cancelled')),
  -- locked: 鎖定期（30天內）
  -- available: 可提領
  -- withdrawn: 已提領
  -- cancelled: 已取消（退款等原因）

  -- 提領關聯
  withdrawal_id UUID REFERENCES affiliate_withdrawals(id) ON DELETE SET NULL,
  withdrawn_at TIMESTAMPTZ,

  -- 取消原因
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX idx_commissions_referral_id ON affiliate_commissions(referral_id);
CREATE INDEX idx_commissions_order_id ON affiliate_commissions(payment_order_id);
CREATE INDEX idx_commissions_status ON affiliate_commissions(status);
CREATE INDEX idx_commissions_unlock_at ON affiliate_commissions(unlock_at);

-- =====================================================
-- 4. 提領申請表
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,

  -- 提領金額
  withdrawal_amount DECIMAL(10,2) NOT NULL, -- 申請提領金額（扣稅前）
  tax_amount DECIMAL(10,2) NOT NULL, -- 扣繳稅額
  net_amount DECIMAL(10,2) NOT NULL, -- 實際撥款金額

  -- 銀行資訊快照（提領時的銀行帳戶）
  bank_code VARCHAR(10) NOT NULL,
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30) NOT NULL,
  bank_account_name VARCHAR(100) NOT NULL,

  -- 證件上傳（首次提領需要）
  requires_documents BOOLEAN DEFAULT false,
  id_document_url TEXT,
  bank_document_url TEXT,
  tax_document_url TEXT,

  -- 審核狀態
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'processing', 'completed', 'rejected', 'cancelled')),
  -- pending: 待審核
  -- reviewing: 審核中
  -- approved: 已核准（等待撥款）
  -- processing: 撥款處理中
  -- completed: 已完成撥款
  -- rejected: 已拒絕
  -- cancelled: 已取消

  -- 審核資訊
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,

  -- 撥款資訊
  payout_method VARCHAR(20) DEFAULT 'bank_transfer', -- 'bank_transfer', 'newebpay'
  payout_batch_id VARCHAR(50), -- 藍新批次號或銀行批次號
  payout_reference VARCHAR(100), -- 撥款參考號
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 佣金明細（JSON 存儲包含哪些佣金記錄）
  commission_ids JSONB, -- [uuid1, uuid2, ...]

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX idx_withdrawals_status ON affiliate_withdrawals(status);
CREATE INDEX idx_withdrawals_created_at ON affiliate_withdrawals(created_at);

-- =====================================================
-- 5. 修改 companies 表，加入推薦碼欄位
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS referred_by_affiliate_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_companies_referred_by ON companies(referred_by_affiliate_code);

-- =====================================================
-- 6. 聯盟行銷追蹤 Cookie 記錄表（可選，用於調試）
CREATE TABLE IF NOT EXISTS affiliate_tracking_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_code VARCHAR(20) NOT NULL,
  event_type VARCHAR(20) NOT NULL, -- 'click', 'visit', 'register', 'payment'

  -- 訪客資訊
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,

  -- 關聯資料
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID,

  -- 額外資訊
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tracking_code ON affiliate_tracking_logs(affiliate_code);
CREATE INDEX idx_tracking_event ON affiliate_tracking_logs(event_type);
CREATE INDEX idx_tracking_created ON affiliate_tracking_logs(created_at);

-- =====================================================
-- 7. 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_referrals_updated_at BEFORE UPDATE ON affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_commissions_updated_at BEFORE UPDATE ON affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_affiliate_withdrawals_updated_at BEFORE UPDATE ON affiliate_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 8. RLS (Row Level Security) 政策

-- affiliates: 只能看自己的資料
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own affiliate data"
  ON affiliates FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own affiliate data"
  ON affiliates FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- affiliate_referrals: 只能看自己推薦的記錄
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own referrals"
  ON affiliate_referrals FOR SELECT
  USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

-- affiliate_commissions: 只能看自己的佣金
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own commissions"
  ON affiliate_commissions FOR SELECT
  USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

-- affiliate_withdrawals: 只能看自己的提領記錄
ALTER TABLE affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawals"
  ON affiliate_withdrawals FOR SELECT
  USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Users can create withdrawal requests"
  ON affiliate_withdrawals FOR INSERT
  WITH CHECK (affiliate_id IN (
    SELECT id FROM affiliates WHERE company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  ));

-- =====================================================
-- 9. 初始資料（範例推薦碼生成函數）
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- 生成 8 位隨機代碼（大寫字母+數字）
    new_code := upper(substring(md5(random()::text) from 1 for 8));

    -- 檢查是否已存在
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = new_code) INTO code_exists;

    -- 如果不存在，返回
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. 自動檢查不活躍狀態的函數（由 Cron Job 呼叫）
CREATE OR REPLACE FUNCTION check_inactive_affiliates()
RETURNS void AS $$
BEGIN
  -- 將超過 3 個月沒有新付款的聯盟夥伴設為 inactive
  UPDATE affiliates
  SET
    status = 'inactive',
    inactive_since = NOW()
  WHERE
    status = 'active'
    AND (
      last_active_payment_at IS NULL
      OR last_active_payment_at < NOW() - INTERVAL '3 months'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 11. 自動解鎖佣金的函數（由 Cron Job 呼叫）
CREATE OR REPLACE FUNCTION unlock_commissions()
RETURNS void AS $$
BEGIN
  -- 將已過鎖定期的佣金狀態改為 available
  UPDATE affiliate_commissions
  SET status = 'available'
  WHERE
    status = 'locked'
    AND unlock_at <= NOW();

  -- 更新聯盟夥伴的可提領餘額
  UPDATE affiliates a
  SET
    pending_commission = (
      SELECT COALESCE(SUM(net_commission), 0)
      FROM affiliate_commissions
      WHERE affiliate_id = a.id AND status = 'available'
    ),
    locked_commission = (
      SELECT COALESCE(SUM(net_commission), 0)
      FROM affiliate_commissions
      WHERE affiliate_id = a.id AND status = 'locked'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 完成
COMMENT ON TABLE affiliates IS '聯盟行銷夥伴主表';
COMMENT ON TABLE affiliate_referrals IS '推薦記錄表';
COMMENT ON TABLE affiliate_commissions IS '佣金記錄表';
COMMENT ON TABLE affiliate_withdrawals IS '提領申請表';
COMMENT ON TABLE affiliate_tracking_logs IS '追蹤日誌表';
