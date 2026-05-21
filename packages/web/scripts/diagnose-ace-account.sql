-- =====================================================
-- 診斷 ace@zhenhe-co.com 帳號的資料完整性
-- =====================================================

\echo '=== 1. 檢查 auth.users 記錄 ==='
SELECT
  id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'ace@zhenhe-co.com';

\echo ''
\echo '=== 2. 檢查 company_members 關聯 ==='
SELECT
  cm.id AS "member_id",
  cm.company_id,
  cm.user_id,
  cm.role,
  cm.status,
  u.email
FROM company_members cm
JOIN auth.users u ON cm.user_id = u.id
WHERE u.email = 'ace@zhenhe-co.com';

\echo ''
\echo '=== 3. 檢查 companies 表資料 ==='
SELECT
  c.id AS "company_id",
  c.name AS "公司名稱",
  c.subscription_tier AS "訂閱層級",
  c.created_at,
  c.updated_at
FROM companies c
JOIN company_members cm ON c.id = cm.company_id
JOIN auth.users u ON cm.user_id = u.id
WHERE u.email = 'ace@zhenhe-co.com';

\echo ''
\echo '=== 4. 檢查 company_subscriptions 記錄 ==='
SELECT
  cs.id AS "subscription_id",
  cs.company_id,
  cs.status,
  cs.monthly_token_quota AS "月配額",
  cs.monthly_quota_balance AS "月餘額",
  cs.purchased_token_balance AS "購買餘額",
  (cs.monthly_quota_balance + cs.purchased_token_balance) AS "總餘額",
  cs.current_period_start AS "週期開始",
  cs.current_period_end AS "週期結束",
  sp.name AS "方案名稱",
  sp.slug AS "方案 Slug"
FROM company_subscriptions cs
LEFT JOIN subscription_plans sp ON cs.subscription_plan_id = sp.id
WHERE cs.company_id IN (
  SELECT cm.company_id
  FROM company_members cm
  JOIN auth.users u ON cm.user_id = u.id
  WHERE u.email = 'ace@zhenhe-co.com'
);

\echo ''
\echo '=== 5. 檢查 FREE 方案定義 ==='
SELECT
  id,
  name,
  slug,
  base_tokens AS "基礎 Tokens",
  monthly_price AS "月費",
  yearly_price AS "年費",
  is_active
FROM subscription_plans
WHERE slug = 'free';

\echo ''
\echo '=== 6. 潛在問題診斷 ==='

-- 檢查是否缺少 company_members 記錄
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '❌ 問題：找不到 company_members 記錄'
    ELSE '✅ OK: company_members 記錄存在'
  END AS "company_members 狀態"
FROM company_members cm
JOIN auth.users u ON cm.user_id = u.id
WHERE u.email = 'ace@zhenhe-co.com';

-- 檢查是否缺少 companies 記錄
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '❌ 問題：找不到 companies 記錄'
    ELSE '✅ OK: companies 記錄存在'
  END AS "companies 狀態"
FROM companies c
JOIN company_members cm ON c.id = cm.company_id
JOIN auth.users u ON cm.user_id = u.id
WHERE u.email = 'ace@zhenhe-co.com';

-- 檢查是否缺少 company_subscriptions 記錄
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '❌ 問題：找不到 company_subscriptions 記錄'
    WHEN COUNT(*) > 1 THEN '⚠️  警告：存在多個 company_subscriptions 記錄'
    ELSE '✅ OK: company_subscriptions 記錄正常'
  END AS "company_subscriptions 狀態"
FROM company_subscriptions cs
WHERE cs.company_id IN (
  SELECT cm.company_id
  FROM company_members cm
  JOIN auth.users u ON cm.user_id = u.id
  WHERE u.email = 'ace@zhenhe-co.com'
);

-- 檢查 Token 餘額是否正確
SELECT
  CASE
    WHEN cs.purchased_token_balance != 10000 THEN
      FORMAT('❌ 問題：購買餘額為 %s，應該是 10000', cs.purchased_token_balance)
    WHEN cs.monthly_token_quota != 0 THEN
      FORMAT('❌ 問題：月配額為 %s，免費方案應該是 0', cs.monthly_token_quota)
    ELSE '✅ OK: Token 餘額正確'
  END AS "Token 餘額狀態"
FROM company_subscriptions cs
WHERE cs.company_id IN (
  SELECT cm.company_id
  FROM company_members cm
  JOIN auth.users u ON cm.user_id = u.id
  WHERE u.email = 'ace@zhenhe-co.com'
)
AND cs.status = 'active'
LIMIT 1;

\echo ''
\echo '=== 7. RLS 政策檢查 ==='
-- 列出 companies 表的 RLS 政策
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'companies'
ORDER BY policyname;
