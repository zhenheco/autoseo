-- =====================================================
-- 新增 companies 表訂閱相關欄位
-- =====================================================

-- 新增 subscription_ends_at 欄位（訂閱到期日）
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN companies.subscription_ends_at IS '訂閱到期日（免費方案為 NULL）';

-- 新增 seo_token_balance 欄位（SEO Token 餘額）
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS seo_token_balance INTEGER NOT NULL DEFAULT 10000;

COMMENT ON COLUMN companies.seo_token_balance IS 'SEO Token 餘額（免費方案預設 10000）';

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_companies_subscription_ends_at ON companies(subscription_ends_at)
  WHERE subscription_ends_at IS NOT NULL;

-- 更新現有 companies 的預設值（確保所有公司都有 token 餘額）
UPDATE companies
SET seo_token_balance = 10000
WHERE seo_token_balance IS NULL OR seo_token_balance = 0;
