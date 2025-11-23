-- =====================================================
-- 清除所有使用者和相關資料腳本
-- =====================================================
-- 警告：這將刪除所有使用者資料，無法恢復！
-- 僅用於開發環境清理，生產環境請謹慎使用
--
-- 執行順序：
-- 1. 刪除所有業務資料（文章、網站等）
-- 2. 刪除所有訂閱和付款資料
-- 3. 刪除所有公司和成員資料
-- 4. 刪除所有推薦和聯盟資料
-- 5. 刪除所有使用者資料（auth.users）
-- =====================================================

-- =====================================================
-- 第一步：刪除業務資料
-- =====================================================

-- 刪除所有文章
DELETE FROM articles;

-- 刪除所有網站
DELETE FROM websites;

-- 刪除所有文章生成任務
DELETE FROM article_jobs;

-- =====================================================
-- 第二步：刪除訂閱和付款資料
-- =====================================================

-- 刪除所有 token 餘額變更記錄
DELETE FROM token_balance_changes;

-- 刪除所有付款訂單
DELETE FROM payment_orders;

-- 刪除所有訂閱（新）
DELETE FROM company_subscriptions;

-- 刪除所有訂閱（舊）
DELETE FROM subscriptions;

-- =====================================================
-- 第三步：刪除推薦和聯盟資料
-- =====================================================

-- 刪除推薦獎勵
DELETE FROM referral_rewards;

-- 刪除推薦記錄
DELETE FROM referrals;

-- 刪除推薦碼
DELETE FROM company_referral_codes;

-- 刪除聯盟提款
DELETE FROM affiliate_withdrawals;

-- 刪除聯盟佣金
DELETE FROM affiliate_commissions;

-- 刪除聯盟計劃成員
DELETE FROM affiliate_program_members;

-- =====================================================
-- 第四步：刪除公司和成員資料
-- =====================================================

-- 刪除公司成員
DELETE FROM company_members;

-- 刪除公司
DELETE FROM companies;

-- =====================================================
-- 第五步：刪除使用者資料（auth schema）
-- =====================================================

-- 刪除所有使用者（這會級聯刪除相關的 auth 資料）
DELETE FROM auth.users;

-- =====================================================
-- 驗證清理結果
-- =====================================================

-- 檢查各表格的記錄數（應該都是 0）
SELECT 'articles' as table_name, COUNT(*) as count FROM articles
UNION ALL
SELECT 'websites', COUNT(*) FROM websites
UNION ALL
SELECT 'article_jobs', COUNT(*) FROM article_jobs
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

-- =====================================================
-- 清理完成提示
-- =====================================================
-- 如果所有表格的 count 都是 0，表示清理成功
