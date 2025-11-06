-- =====================================================
-- 聯盟行銷系統資料表 (修正版)
-- =====================================================

-- 0. 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 0.1 先確保 companies 表存在（如果不存在則創建基本版本）
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  owner_id UUID NOT NULL,
  subscription_tier VARCHAR(50) DEFAULT 'free',
  subscription_ends_at TIMESTAMPTZ,
  seo_token_balance INTEGER DEFAULT 0,
  newebpay_customer_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 0.2 確保 companies 表有必要欄位（如果已存在則跳過）
DO $$
BEGIN
  -- 檢查並新增 referred_by_affiliate_code 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'referred_by_affiliate_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN referred_by_affiliate_code VARCHAR(20);
  END IF;

  -- 檢查並新增 referred_at 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'referred_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN referred_at TIMESTAMPTZ;
  END IF;
END $$;

-- 1. 聯盟夥伴主表
CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- 推薦碼（唯一）
  affiliate_code VARCHAR(20) UNIQUE NOT NULL,

  -- 基本資料
  full_name VARCHAR(100) NOT NULL,
  id_number VARCHAR(20) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(100) NOT NULL,
  address TEXT NOT NULL,

  -- 銀行帳戶資訊
  bank_code VARCHAR(10),
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30),
  bank_account_name VARCHAR(100),

  -- 稅務資訊
  is_resident BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 10.00,
  tax_id_verified BOOLEAN DEFAULT false,

  -- 證件上傳
  id_document_url TEXT,
  bank_document_url TEXT,
  tax_document_url TEXT,
  documents_verified BOOLEAN DEFAULT false,
  documents_verified_at TIMESTAMPTZ,

  -- 佣金統計
  total_referrals INTEGER DEFAULT 0,
  active_referrals INTEGER DEFAULT 0,
  pending_commission DECIMAL(10,2) DEFAULT 0,
  locked_commission DECIMAL(10,2) DEFAULT 0,
  withdrawn_commission DECIMAL(10,2) DEFAULT 0,
  lifetime_commission DECIMAL(10,2) DEFAULT 0,

  -- 活躍狀態追蹤
  last_referral_at TIMESTAMPTZ,
  last_active_payment_at TIMESTAMPTZ,
  inactive_since TIMESTAMPTZ,

  -- 狀態
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'terminated')),

  -- 審核資訊
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- 備註
  notes TEXT,

  -- 時間戳記
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_affiliates_company_id ON affiliates(company_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status);
CREATE INDEX IF NOT EXISTS idx_affiliates_last_active ON affiliates(last_active_payment_at);

-- 2. 推薦記錄表
CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_company_id UUID NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  affiliate_code VARCHAR(20) NOT NULL,

  -- 追蹤資訊
  referral_source VARCHAR(50),
  user_agent TEXT,
  ip_address INET,

  -- 轉換追蹤
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  first_payment_at TIMESTAMPTZ,
  first_payment_amount DECIMAL(10,2),

  -- 生命週期價值
  total_payments INTEGER DEFAULT 0,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  total_commission_generated DECIMAL(10,2) DEFAULT 0,

  -- 活躍狀態
  last_payment_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_company_id ON affiliate_referrals(referred_company_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON affiliate_referrals(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_referrals_first_payment ON affiliate_referrals(first_payment_at);

-- 3. 佣金記錄表
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,

  -- 訂單關聯（暫時允許 NULL，因為 payment_orders 表可能不存在）
  payment_order_id UUID,
  mandate_id UUID,

  -- 訂單資訊
  order_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  commission_amount DECIMAL(10,2) NOT NULL,

  -- 扣繳稅款
  tax_rate DECIMAL(5,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  net_commission DECIMAL(10,2) NOT NULL,

  -- 鎖定期管理
  earned_at TIMESTAMPTZ NOT NULL,
  unlock_at TIMESTAMPTZ NOT NULL,

  -- 狀態
  status VARCHAR(20) DEFAULT 'locked' CHECK (status IN ('locked', 'available', 'withdrawn', 'cancelled')),

  -- 提領關聯
  withdrawal_id UUID,
  withdrawn_at TIMESTAMPTZ,

  -- 取消原因
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_referral_id ON affiliate_commissions(referral_id);
CREATE INDEX IF NOT EXISTS idx_commissions_order_id ON affiliate_commissions(payment_order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS idx_commissions_unlock_at ON affiliate_commissions(unlock_at);

-- 4. 提領申請表
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,

  -- 提領金額
  withdrawal_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,

  -- 銀行資訊快照
  bank_code VARCHAR(10) NOT NULL,
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30) NOT NULL,
  bank_account_name VARCHAR(100) NOT NULL,

  -- 證件上傳
  requires_documents BOOLEAN DEFAULT false,
  id_document_url TEXT,
  bank_document_url TEXT,
  tax_document_url TEXT,

  -- 審核狀態
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'approved', 'processing', 'completed', 'rejected', 'cancelled')),

  -- 審核資訊
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,

  -- 撥款資訊
  payout_method VARCHAR(20) DEFAULT 'bank_transfer',
  payout_batch_id VARCHAR(50),
  payout_reference VARCHAR(100),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 佣金明細
  commission_ids JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON affiliate_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON affiliate_withdrawals(created_at);

-- 5. 聯盟行銷追蹤 Cookie 記錄表
CREATE TABLE IF NOT EXISTS affiliate_tracking_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_code VARCHAR(20) NOT NULL,
  event_type VARCHAR(20) NOT NULL,

  -- 訪客資訊
  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,

  -- 關聯資料
  company_id UUID,
  user_id UUID,

  -- 額外資訊
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_code ON affiliate_tracking_logs(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_tracking_event ON affiliate_tracking_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON affiliate_tracking_logs(created_at);

-- 6. 在 companies 表新增索引
CREATE INDEX IF NOT EXISTS idx_companies_referred_by ON companies(referred_by_affiliate_code);

-- 7. 觸發器：自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_affiliates_updated_at ON affiliates;
CREATE TRIGGER update_affiliates_updated_at BEFORE UPDATE ON affiliates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_affiliate_referrals_updated_at ON affiliate_referrals;
CREATE TRIGGER update_affiliate_referrals_updated_at BEFORE UPDATE ON affiliate_referrals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_affiliate_commissions_updated_at ON affiliate_commissions;
CREATE TRIGGER update_affiliate_commissions_updated_at BEFORE UPDATE ON affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_affiliate_withdrawals_updated_at ON affiliate_withdrawals;
CREATE TRIGGER update_affiliate_withdrawals_updated_at BEFORE UPDATE ON affiliate_withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. 推薦碼生成函數
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- 生成 8 位隨機代碼
    new_code := upper(substring(md5(random()::text) from 1 for 8));

    -- 檢查是否已存在
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = new_code) INTO code_exists;

    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. 自動檢查不活躍狀態的函數
CREATE OR REPLACE FUNCTION check_inactive_affiliates()
RETURNS void AS $$
BEGIN
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

-- 10. 自動解鎖佣金的函數
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

-- 11. RLS (Row Level Security) 政策
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_withdrawals ENABLE ROW LEVEL SECURITY;

-- 完成
SELECT 'Migration completed successfully!' AS status;
