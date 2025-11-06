-- =====================================================
-- 添加缺少的欄位到現有 affiliates 表
-- 保留所有現有資料和欄位
-- =====================================================

-- 1. affiliates 表：添加缺少的欄位
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS id_number VARCHAR(20);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS email VARCHAR(100);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS address TEXT;

-- 銀行資訊
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS bank_code VARCHAR(10);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(100);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS bank_account VARCHAR(30);
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS bank_account_name VARCHAR(100);

-- 稅務資訊
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS is_resident BOOLEAN DEFAULT true;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 10.00;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS tax_id_verified BOOLEAN DEFAULT false;

-- 證件
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS id_document_url TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS bank_document_url TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS tax_document_url TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS documents_verified BOOLEAN DEFAULT false;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS documents_verified_at TIMESTAMPTZ;

-- 佣金統計（補充缺少的）
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS locked_commission DECIMAL(10,2) DEFAULT 0;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS withdrawn_commission DECIMAL(10,2) DEFAULT 0;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS lifetime_commission DECIMAL(10,2) DEFAULT 0;

-- 狀態追蹤
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS last_referral_at TIMESTAMPTZ;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS last_active_payment_at TIMESTAMPTZ;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS inactive_since TIMESTAMPTZ;

-- 審核
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE affiliates ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. 同步現有資料（如果有 user_id，複製到 company_id）
UPDATE affiliates
SET company_id = user_id
WHERE company_id IS NULL AND user_id IS NOT NULL;

-- 3. 創建索引（如果不存在）
CREATE INDEX IF NOT EXISTS idx_affiliates_company_id ON affiliates(company_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);

-- 4. 檢查 affiliate_referrals 表需要的欄位
-- 檢查是否缺少欄位
DO $$
BEGIN
  -- 檢查 affiliate_code
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'affiliate_code'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN affiliate_code VARCHAR(20);
  END IF;

  -- 檢查 referral_source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'referral_source'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN referral_source VARCHAR(50);
  END IF;

  -- 檢查 user_agent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'user_agent'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN user_agent TEXT;
  END IF;

  -- 檢查 ip_address
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN ip_address INET;
  END IF;

  -- 檢查 first_payment_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'first_payment_at'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN first_payment_at TIMESTAMPTZ;
  END IF;

  -- 檢查 first_payment_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'first_payment_amount'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN first_payment_amount DECIMAL(10,2);
  END IF;

  -- 檢查 total_payments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'total_payments'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN total_payments INTEGER DEFAULT 0;
  END IF;

  -- 檢查 lifetime_value
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'lifetime_value'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN lifetime_value DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- 檢查 total_commission_generated
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'total_commission_generated'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN total_commission_generated DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- 檢查 last_payment_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'last_payment_at'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN last_payment_at TIMESTAMPTZ;
  END IF;

  -- 檢查 is_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;

  -- 檢查 cancelled_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_referrals' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE affiliate_referrals ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;
END $$;

-- 5. 檢查 affiliate_commissions 表的欄位
DO $$
BEGIN
  -- 檢查 payment_order_id (我用的名稱)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'payment_order_id'
  ) THEN
    -- 如果有 order_id，可以重命名；否則創建新欄位
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'affiliate_commissions' AND column_name = 'order_id'
    ) THEN
      -- 創建別名視圖或直接使用 order_id（代碼需要調整）
      ALTER TABLE affiliate_commissions ADD COLUMN payment_order_id UUID;
      -- 同步資料
      UPDATE affiliate_commissions SET payment_order_id = order_id WHERE payment_order_id IS NULL;
    ELSE
      ALTER TABLE affiliate_commissions ADD COLUMN payment_order_id UUID;
    END IF;
  END IF;

  -- 檢查 mandate_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'mandate_id'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN mandate_id UUID;
  END IF;

  -- 檢查 order_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'order_amount'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN order_amount DECIMAL(10,2);
  END IF;

  -- 檢查 commission_rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'commission_rate'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 20.00;
  END IF;

  -- 檢查 commission_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'commission_amount'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN commission_amount DECIMAL(10,2);
  END IF;

  -- 檢查 tax_rate
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'tax_rate'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN tax_rate DECIMAL(5,2);
  END IF;

  -- 檢查 tax_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'tax_amount'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN tax_amount DECIMAL(10,2);
  END IF;

  -- 檢查 net_commission
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'net_commission'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN net_commission DECIMAL(10,2);
  END IF;

  -- 檢查 earned_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'earned_at'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN earned_at TIMESTAMPTZ;
  END IF;

  -- 檢查 unlock_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'unlock_at'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN unlock_at TIMESTAMPTZ;
  END IF;

  -- 檢查 withdrawal_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'withdrawal_id'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN withdrawal_id UUID;
  END IF;

  -- 檢查 withdrawn_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'withdrawn_at'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN withdrawn_at TIMESTAMPTZ;
  END IF;

  -- 檢查 cancelled_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN cancelled_at TIMESTAMPTZ;
  END IF;

  -- 檢查 cancel_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'affiliate_commissions' AND column_name = 'cancel_reason'
  ) THEN
    ALTER TABLE affiliate_commissions ADD COLUMN cancel_reason TEXT;
  END IF;
END $$;

-- 6. 創建 affiliate_withdrawals 表（如果不存在）
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,

  withdrawal_amount DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,

  bank_code VARCHAR(10) NOT NULL,
  bank_branch VARCHAR(100),
  bank_account VARCHAR(30) NOT NULL,
  bank_account_name VARCHAR(100) NOT NULL,

  requires_documents BOOLEAN DEFAULT false,
  id_document_url TEXT,
  bank_document_url TEXT,
  tax_document_url TEXT,

  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_notes TEXT,

  payout_method VARCHAR(20) DEFAULT 'bank_transfer',
  payout_batch_id VARCHAR(50),
  payout_reference VARCHAR(100),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  commission_ids JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_affiliate_id ON affiliate_withdrawals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON affiliate_withdrawals(status);

-- 7. 創建 affiliate_tracking_logs 表（如果不存在）
CREATE TABLE IF NOT EXISTS affiliate_tracking_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_code VARCHAR(20) NOT NULL,
  event_type VARCHAR(20) NOT NULL,

  session_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  referer TEXT,

  company_id UUID,
  user_id UUID,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracking_code ON affiliate_tracking_logs(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_tracking_event ON affiliate_tracking_logs(event_type);

-- 8. 創建或替換函數
CREATE OR REPLACE FUNCTION generate_affiliate_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  new_code VARCHAR(20);
  code_exists BOOLEAN;
BEGIN
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM affiliates WHERE affiliate_code = new_code) INTO code_exists;
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unlock_commissions()
RETURNS void AS $$
BEGIN
  UPDATE affiliate_commissions SET status = 'available'
  WHERE status = 'locked' AND unlock_at <= NOW();

  UPDATE affiliates a SET
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

CREATE OR REPLACE FUNCTION check_inactive_affiliates()
RETURNS void AS $$
BEGIN
  UPDATE affiliates
  SET status = 'inactive', inactive_since = NOW()
  WHERE status = 'active'
    AND (last_active_payment_at IS NULL
      OR last_active_payment_at < NOW() - INTERVAL '3 months');
END;
$$ LANGUAGE plpgsql;

-- 9. 驗證結果
SELECT
  'affiliates' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliates') as column_count,
  (SELECT COUNT(*) FROM affiliates) as row_count;

SELECT
  'affiliate_referrals' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_referrals') as column_count,
  (SELECT COUNT(*) FROM affiliate_referrals) as row_count;

SELECT
  'affiliate_commissions' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_commissions') as column_count,
  (SELECT COUNT(*) FROM affiliate_commissions) as row_count;

SELECT
  'affiliate_withdrawals' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_withdrawals') as column_count,
  (SELECT COUNT(*) FROM affiliate_withdrawals) as row_count;

SELECT
  'affiliate_tracking_logs' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_tracking_logs') as column_count,
  (SELECT COUNT(*) FROM affiliate_tracking_logs) as row_count;

SELECT 'Migration completed successfully!' as status;
