-- 1. 處理所有 foreign key constraints
UPDATE company_members
SET invited_by = NULL
WHERE invited_by IN (
  SELECT id FROM auth.users WHERE email = 'ace@zhenhe-co.com'
);

-- 2. 刪除 article_jobs (新發現的依賴)
DELETE FROM article_jobs
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'ace@zhenhe-co.com'
);

-- 3. 刪除所有相關資料
DELETE FROM token_balance_changes
WHERE company_id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9';

DELETE FROM payment_orders
WHERE company_id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9';

DELETE FROM recurring_mandates
WHERE company_id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9';

DELETE FROM company_subscriptions
WHERE company_id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9';

DELETE FROM company_members
WHERE company_id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9';

DELETE FROM companies
WHERE id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9';

-- 4. 刪除使用者帳號
DELETE FROM auth.users
WHERE email = 'ace@zhenhe-co.com';

-- 5. 驗證刪除結果
SELECT 
  'Users' as table_name,
  COUNT(*) as count
FROM auth.users
WHERE email = 'ace@zhenhe-co.com'
UNION ALL
SELECT 
  'Companies' as table_name,
  COUNT(*) as count
FROM companies
WHERE id = '8e51fa71-5f0a-450e-b9a7-a7f8aa71abb9'
UNION ALL
SELECT 
  'Article Jobs' as table_name,
  COUNT(*) as count
FROM article_jobs
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'ace@zhenhe-co.com'
);
