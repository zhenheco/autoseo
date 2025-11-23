-- =====================================================
-- Token Billing System MVP - 雙餘額分離與推薦系統
-- =====================================================

-- 1. 修改 company_subscriptions 表：分離 Token 餘額
ALTER TABLE company_subscriptions
  ADD COLUMN IF NOT EXISTS purchased_token_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_quota_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_lifetime BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lifetime_discount DECIMAL(3,2) DEFAULT 1.0;

COMMENT ON COLUMN company_subscriptions.purchased_token_balance IS '購買的 Token（永不過期）';
COMMENT ON COLUMN company_subscriptions.monthly_quota_balance IS '月費贈送的 Token（每月重置）';
COMMENT ON COLUMN company_subscriptions.is_lifetime IS '是否為終身方案';
COMMENT ON COLUMN company_subscriptions.lifetime_discount IS '終身方案折扣（0.8 = 8折）';

-- 2. 推薦關係表
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_company_id UUID NOT NULL REFERENCES companies(id),
  referred_company_id UUID NOT NULL REFERENCES companies(id),
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  referred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  first_payment_at TIMESTAMP WITH TIME ZONE,
  rewarded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referred_company_id)
);

COMMENT ON TABLE referrals IS '推薦關係追蹤';

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_company_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- 3. 推薦獎勵記錄
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_id UUID NOT NULL REFERENCES referrals(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('signup', 'first_payment', 'revenue_share')),
  token_amount INTEGER,
  cash_amount DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE referral_rewards IS '推薦獎勵發放記錄';

-- 4. 公司推薦碼表
CREATE TABLE IF NOT EXISTS company_referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  referral_code TEXT UNIQUE NOT NULL,
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  total_rewards_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE company_referral_codes IS '公司專屬推薦碼';

-- 5. RLS 政策

-- referrals
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司可查看自己的推薦記錄" ON referrals
  FOR SELECT USING (
    referrer_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR referred_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- referral_rewards
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司可查看自己的推薦獎勵" ON referral_rewards
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- company_referral_codes
ALTER TABLE company_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "公司可查看自己的推薦碼" ON company_referral_codes
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );
