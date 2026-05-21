-- 查詢所有訂閱方案的設定
SELECT 
  id,
  name,
  slug,
  monthly_price,
  yearly_price,
  lifetime_price,
  base_tokens,
  is_lifetime,
  features
FROM subscription_plans
ORDER BY 
  is_lifetime ASC,
  monthly_price ASC;

-- 查詢所有 token 包設定
SELECT 
  id,
  name,
  slug,
  tokens,
  price
FROM token_packages
ORDER BY price ASC;
