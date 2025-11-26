-- ===========================================
-- Free Trial Limit Migration
-- 新增終身文章限制欄位，支援免費方案試用機制
-- ===========================================

-- 在 company_subscriptions 新增終身文章限制欄位
ALTER TABLE company_subscriptions
ADD COLUMN IF NOT EXISTS lifetime_free_articles_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lifetime_free_articles_limit INTEGER DEFAULT 3;

-- 寬限現有用戶：將現有 free 用戶的 limit 設為 -1（無限制）
-- 只對 migration 執行時已存在的公司套用
UPDATE company_subscriptions cs
SET lifetime_free_articles_limit = -1
WHERE EXISTS (
  SELECT 1 FROM companies c
  WHERE c.id = cs.company_id
  AND c.subscription_tier = 'free'
);

-- 為了冪等性，在 article_jobs 新增標記（避免重複扣除配額）
ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS free_quota_deducted BOOLEAN DEFAULT FALSE;

-- 註解說明
COMMENT ON COLUMN company_subscriptions.lifetime_free_articles_used IS
  'Free plan lifetime article counter (never resets, tracks total articles generated under free plan)';
COMMENT ON COLUMN company_subscriptions.lifetime_free_articles_limit IS
  'Free plan lifetime limit (-1 = unlimited for grandfathered users, 3 = default for new users)';
COMMENT ON COLUMN article_jobs.free_quota_deducted IS
  'Flag to ensure free quota is only deducted once per job (idempotency)';

-- 建立索引（用於快速查詢免費用戶配額狀態）
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_free_limit
ON company_subscriptions(lifetime_free_articles_used, lifetime_free_articles_limit)
WHERE lifetime_free_articles_limit > 0;
