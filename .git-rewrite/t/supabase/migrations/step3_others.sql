-- =====================================================
-- 步驟 3：創建其他表和函數
-- =====================================================

-- 3.1 佣金表
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referral_id UUID NOT NULL REFERENCES affiliate_referrals(id) ON DELETE CASCADE,
  payment_order_id UUID,
  mandate_id UUID,

  order_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  commission_amount DECIMAL(10,2) NOT NULL,

  tax_rate DECIMAL(5,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  net_commission DECIMAL(10,2) NOT NULL,

  earned_at TIMESTAMPTZ NOT NULL,
  unlock_at TIMESTAMPTZ NOT NULL,

  status VARCHAR(20) DEFAULT 'locked',
  withdrawal_id UUID,
  withdrawn_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_id ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON affiliate_commissions(status);

-- 3.2 提領表
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

-- 3.3 追蹤日誌
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

-- 3.4 函數
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

-- 完成測試
SELECT
  'All tables created!' as status,
  (SELECT COUNT(*) FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name LIKE 'affiliate%') as table_count;
