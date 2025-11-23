-- 修正 FREE 方案的 base_tokens 從 20000 改為 10000
UPDATE subscription_plans
SET base_tokens = 10000
WHERE slug = 'free';

-- 驗證修正結果
SELECT 
  name,
  slug,
  base_tokens,
  monthly_price
FROM subscription_plans
WHERE slug = 'free';
