-- =====================================================
-- 篇數制訂閱系統 - Step 3: 修改 company_subscriptions 表
-- =====================================================
-- 說明：新增篇數制相關欄位

-- 1. 新增篇數相關欄位
ALTER TABLE company_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_articles_remaining INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS purchased_articles_remaining INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS articles_per_month INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN IF NOT EXISTS last_quota_reset_at TIMESTAMPTZ DEFAULT NOW();

-- 2. 建立索引
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_billing_cycle
  ON company_subscriptions(billing_cycle);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_period_end
  ON company_subscriptions(current_period_end)
  WHERE status = 'active';

-- 3. 註解
COMMENT ON COLUMN company_subscriptions.subscription_articles_remaining IS '訂閱方案剩餘篇數（每月重置）';
COMMENT ON COLUMN company_subscriptions.purchased_articles_remaining IS '加購篇數剩餘（永久有效，含年繳贈品）';
COMMENT ON COLUMN company_subscriptions.articles_per_month IS '每月配額篇數';
COMMENT ON COLUMN company_subscriptions.billing_cycle IS '計費週期：monthly（月繳）或 yearly（年繳）';
COMMENT ON COLUMN company_subscriptions.last_quota_reset_at IS '上次配額重置時間';

-- 4. 初始化現有用戶的篇數（如果有的話）
-- 這裡根據方案設定初始值
UPDATE company_subscriptions cs
SET
  articles_per_month = COALESCE(sp.articles_per_month, 0),
  subscription_articles_remaining = COALESCE(sp.articles_per_month, 0),
  last_quota_reset_at = NOW()
FROM subscription_plans sp
WHERE cs.plan_id = sp.id
  AND cs.subscription_articles_remaining = 0
  AND sp.articles_per_month > 0;
