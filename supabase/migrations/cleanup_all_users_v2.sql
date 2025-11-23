-- =====================================================
-- 清除所有使用者和相關資料腳本 (v2)
-- =====================================================
-- 警告：這將刪除所有使用者資料，無法恢復！
-- 僅用於開發環境清理，生產環境請謹慎使用
-- =====================================================

-- =====================================================
-- 第一步：先檢查存在的表格
-- =====================================================

-- 列出所有 public schema 的表格
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- =====================================================
-- 第二步：刪除資料（僅刪除存在的表格）
-- =====================================================

-- 刪除業務資料
DELETE FROM article_jobs WHERE true;
DELETE FROM websites WHERE true;

-- 刪除訂閱和付款資料
DELETE FROM token_balance_changes WHERE true;
DELETE FROM payment_orders WHERE true;
DELETE FROM company_subscriptions WHERE true;
DELETE FROM subscriptions WHERE true;

-- 刪除推薦和聯盟資料
DELETE FROM referral_rewards WHERE true;
DELETE FROM referrals WHERE true;
DELETE FROM company_referral_codes WHERE true;
DELETE FROM affiliate_withdrawals WHERE true;
DELETE FROM affiliate_commissions WHERE true;
DELETE FROM affiliate_program_members WHERE true;

-- 刪除公司和成員資料
DELETE FROM company_members WHERE true;
DELETE FROM companies WHERE true;

-- =====================================================
-- 第三步：刪除使用者資料（auth schema）
-- =====================================================

-- 刪除所有使用者（這會級聯刪除相關的 auth 資料）
DELETE FROM auth.users WHERE true;

-- =====================================================
-- 驗證清理結果
-- =====================================================

-- 檢查各表格的記錄數（應該都是 0）
SELECT 'article_jobs' as table_name, COUNT(*) as count FROM article_jobs
UNION ALL
SELECT 'websites', COUNT(*) FROM websites
UNION ALL
SELECT 'token_balance_changes', COUNT(*) FROM token_balance_changes
UNION ALL
SELECT 'payment_orders', COUNT(*) FROM payment_orders
UNION ALL
SELECT 'company_subscriptions', COUNT(*) FROM company_subscriptions
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'referral_rewards', COUNT(*) FROM referral_rewards
UNION ALL
SELECT 'referrals', COUNT(*) FROM referrals
UNION ALL
SELECT 'company_referral_codes', COUNT(*) FROM company_referral_codes
UNION ALL
SELECT 'affiliate_withdrawals', COUNT(*) FROM affiliate_withdrawals
UNION ALL
SELECT 'affiliate_commissions', COUNT(*) FROM affiliate_commissions
UNION ALL
SELECT 'affiliate_program_members', COUNT(*) FROM affiliate_program_members
UNION ALL
SELECT 'company_members', COUNT(*) FROM company_members
UNION ALL
SELECT 'companies', COUNT(*) FROM companies
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;
