-- =====================================================
-- 步驟 2：創建 affiliate_referrals 表
-- =====================================================

CREATE TABLE IF NOT EXISTS affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  referred_company_id UUID NOT NULL UNIQUE,
  affiliate_code VARCHAR(20) NOT NULL,

  -- 追蹤
  referral_source VARCHAR(50),
  user_agent TEXT,
  ip_address INET,

  -- 轉換
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  first_payment_at TIMESTAMPTZ,
  first_payment_amount DECIMAL(10,2),

  -- 統計
  total_payments INTEGER DEFAULT 0,
  lifetime_value DECIMAL(10,2) DEFAULT 0,
  total_commission_generated DECIMAL(10,2) DEFAULT 0,

  -- 狀態
  last_payment_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_affiliate_id ON affiliate_referrals(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_referrals_company_id ON affiliate_referrals(referred_company_id);

-- 測試查詢
SELECT COUNT(*) as referrals_table_ready FROM affiliate_referrals;
