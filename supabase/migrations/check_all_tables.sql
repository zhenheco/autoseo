-- 檢查所有 affiliate 相關表的完整結構

-- 1. affiliates 表
SELECT 'affiliates' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'affiliates'
ORDER BY ordinal_position;

-- 2. affiliate_referrals 表
SELECT 'affiliate_referrals' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'affiliate_referrals'
ORDER BY ordinal_position;

-- 3. affiliate_commissions 表
SELECT 'affiliate_commissions' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'affiliate_commissions'
ORDER BY ordinal_position;

-- 4. affiliate_withdrawals 表（如果存在）
SELECT 'affiliate_withdrawals' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'affiliate_withdrawals'
ORDER BY ordinal_position;

-- 5. affiliate_tracking_logs 表（如果存在）
SELECT 'affiliate_tracking_logs' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'affiliate_tracking_logs'
ORDER BY ordinal_position;

-- 6. 檢查 companies 表的結構
SELECT 'companies' as table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;
