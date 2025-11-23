-- 檢查當前的訂閱方案資料
SELECT
  id,
  name,
  slug,
  monthly_price,
  yearly_price,
  lifetime_price,
  base_tokens,
  is_lifetime,
  features,
  created_at
FROM subscription_plans
ORDER BY monthly_price ASC;

-- 檢查當前有多少用戶訂閱
SELECT
  cs.id,
  cs.company_id,
  cs.plan_id,
  cs.status,
  cs.is_lifetime,
  cs.monthly_token_quota,
  cs.monthly_quota_balance,
  cs.purchased_token_balance,
  sp.name as plan_name,
  sp.slug as plan_slug
FROM company_subscriptions cs
LEFT JOIN subscription_plans sp ON cs.plan_id = sp.id
ORDER BY cs.created_at DESC
LIMIT 10;

-- 統計各方案的訂閱數量
SELECT
  sp.name,
  sp.slug,
  sp.is_lifetime,
  COUNT(cs.id) as subscription_count
FROM subscription_plans sp
LEFT JOIN company_subscriptions cs ON sp.id = cs.plan_id
GROUP BY sp.id, sp.name, sp.slug, sp.is_lifetime
ORDER BY sp.monthly_price ASC;
