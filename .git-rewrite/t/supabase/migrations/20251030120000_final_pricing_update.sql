-- =====================================================
-- 最終定價方案更新
-- =====================================================

-- 1. 清空現有方案資料
TRUNCATE subscription_plans CASCADE;
TRUNCATE token_packages CASCADE;

-- 2. 新增月費方案（移除 FREE，Token 配額 ×200%）
INSERT INTO subscription_plans (name, slug, monthly_price, base_tokens, features, limits, is_lifetime, lifetime_price) VALUES
-- 月費方案
('STARTER', 'starter', 399, 20000,
  '{
    "models": ["deepseek-chat", "gemini-2-flash", "gpt-5-mini"],
    "wordpress_sites": 1,
    "images_per_article": 3,
    "batch_generation": 5,
    "team_members": 1,
    "scheduling": "basic",
    "seo_score": true,
    "brand_voices": 0
  }'::jsonb,
  '{
    "api_access": false,
    "priority_support": false,
    "white_label": false
  }'::jsonb,
  false, NULL),

('PROFESSIONAL', 'professional', 1999, 80000,
  '{
    "models": "all",
    "wordpress_sites": 5,
    "images_per_article": 5,
    "batch_generation": 20,
    "team_members": 3,
    "scheduling": "advanced",
    "seo_score": true,
    "brand_voices": 1,
    "api_access": true
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false
  }'::jsonb,
  false, NULL),

('BUSINESS', 'business', 4999, 240000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": 60,
    "team_members": 10,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": 3,
    "api_access": true
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false
  }'::jsonb,
  false, NULL),

('AGENCY', 'agency', 9999, 600000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": 150,
    "team_members": -1,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": -1,
    "api_access": true,
    "white_label": true
  }'::jsonb,
  '{
    "priority_support": true,
    "dedicated_manager": true
  }'::jsonb,
  false, NULL),

-- 終身方案
('LIFETIME_STARTER', 'lifetime-starter', 0, 20000,
  '{
    "models": ["deepseek-chat", "gemini-2-flash", "gpt-5-mini"],
    "wordpress_sites": 1,
    "images_per_article": 3,
    "batch_generation": 5,
    "team_members": 1,
    "scheduling": "basic",
    "seo_score": true,
    "brand_voices": 0
  }'::jsonb,
  '{
    "api_access": false,
    "priority_support": false,
    "white_label": false
  }'::jsonb,
  true, 2999),

('LIFETIME_PROFESSIONAL', 'lifetime-professional', 0, 80000,
  '{
    "models": "all",
    "wordpress_sites": 5,
    "images_per_article": 5,
    "batch_generation": 20,
    "team_members": 3,
    "scheduling": "advanced",
    "seo_score": true,
    "brand_voices": 1,
    "api_access": true
  }'::jsonb,
  '{
    "priority_support": false,
    "white_label": false
  }'::jsonb,
  true, 9999),

('LIFETIME_BUSINESS', 'lifetime-business', 0, 240000,
  '{
    "models": "all",
    "wordpress_sites": -1,
    "images_per_article": -1,
    "batch_generation": 60,
    "team_members": 10,
    "scheduling": "smart",
    "seo_score": true,
    "brand_voices": 3,
    "api_access": true
  }'::jsonb,
  '{
    "priority_support": true,
    "white_label": false
  }'::jsonb,
  true, 29999);

-- 3. 新增 Token 購買包（新定價）
INSERT INTO token_packages (name, slug, tokens, price, bonus_tokens, description) VALUES
('入門包', 'entry-10k', 10000, 99, 0, '適合新手體驗，省 50% 起'),
('標準包', 'standard-50k', 50000, 399, 0, '最受歡迎，省 52%'),
('進階包', 'advanced-100k', 100,000, 699, 0, '進階用戶，省 54%'),
('專業包', 'pro-300k', 300000, 1799, 0, '專業創作者，省 57%'),
('企業包', 'enterprise-500k', 500000, 2499, 0, '企業級別，省 60%'),
('旗艦包', 'flagship-1m', 1000000, 3999, 0, '超大容量，省 63%');

-- 4. 移除月訂閱 Token 方案（改成單純的 Token 購買包）
-- 月訂閱 Token 方案暫時不需要

-- 5. 新增經銷商相關表
CREATE TABLE IF NOT EXISTS resellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  commission_rate DECIMAL(4,3) NOT NULL DEFAULT 0.200,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  total_referrals INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_commission DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE resellers IS '經銷商資料（手動管理）';
COMMENT ON COLUMN resellers.commission_rate IS '佣金比例（0.200 = 20%）';

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'token_package', 'lifetime')),
  order_id UUID NOT NULL,
  customer_company_id UUID NOT NULL REFERENCES companies(id),
  order_amount DECIMAL(10,2) NOT NULL,
  commission_rate DECIMAL(4,3) NOT NULL,
  commission_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE commissions IS '佣金記錄';
COMMENT ON COLUMN commissions.order_type IS '訂單類型：subscription（月費）, token_package（Token包）, lifetime（終身）';

CREATE INDEX idx_resellers_company ON resellers(company_id);
CREATE INDEX idx_resellers_status ON resellers(status);
CREATE INDEX idx_commissions_reseller ON commissions(reseller_id);
CREATE INDEX idx_commissions_status ON commissions(status);
CREATE INDEX idx_commissions_customer ON commissions(customer_company_id);

-- 6. RLS 政策

-- resellers
ALTER TABLE resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "經銷商可查看自己的資料" ON resellers
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- commissions
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "經銷商可查看自己的佣金記錄" ON commissions
  FOR SELECT USING (
    reseller_id IN (
      SELECT id FROM resellers WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- 7. 自動更新經銷商統計的函數
CREATE OR REPLACE FUNCTION update_reseller_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE resellers
    SET
      total_referrals = total_referrals + 1,
      total_revenue = total_revenue + NEW.order_amount,
      total_commission = total_commission + NEW.commission_amount,
      updated_at = NOW()
    WHERE id = NEW.reseller_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reseller_stats
  AFTER INSERT ON commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_reseller_stats();

-- 8. 新增欄位說明註解
COMMENT ON COLUMN subscription_plans.features IS '功能特性：包含 models, wordpress_sites, images_per_article, batch_generation, team_members, scheduling, seo_score, brand_voices, api_access, white_label';
COMMENT ON COLUMN subscription_plans.limits IS '限制項目：priority_support, dedicated_manager 等';
