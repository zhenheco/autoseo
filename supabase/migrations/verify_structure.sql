-- =====================================================
-- 驗證資料庫結構
-- =====================================================

-- 檢查 affiliates 表是否有必要欄位
SELECT
  'affiliates必要欄位檢查' as check_type,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'company_id') as has_company_id,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'full_name') as has_full_name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'id_number') as has_id_number,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'phone') as has_phone,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'email') as has_email,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'address') as has_address,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'is_resident') as has_is_resident,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'tax_rate') as has_tax_rate,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'bank_code') as has_bank_code,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'affiliates' AND column_name = 'bank_account') as has_bank_account;

-- 檢查所有表是否存在
SELECT
  '所有表檢查' as check_type,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliates') as has_affiliates,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_referrals') as has_referrals,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_commissions') as has_commissions,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_withdrawals') as has_withdrawals,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'affiliate_tracking_logs') as has_tracking;

-- 檢查函數是否存在
SELECT
  '函數檢查' as check_type,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'generate_affiliate_code') as has_generate_code,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'unlock_commissions') as has_unlock_commissions,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_inactive_affiliates') as has_check_inactive;

-- 統計各表欄位數和資料筆數
SELECT
  'affiliates' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliates') as column_count,
  (SELECT COUNT(*) FROM affiliates) as row_count;

SELECT
  'affiliate_referrals' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_referrals') as column_count,
  (SELECT COUNT(*) FROM affiliate_referrals) as row_count;

SELECT
  'affiliate_commissions' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_commissions') as column_count,
  (SELECT COUNT(*) FROM affiliate_commissions) as row_count;

SELECT
  'affiliate_withdrawals' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_withdrawals') as column_count,
  (SELECT COUNT(*) FROM affiliate_withdrawals) as row_count;

SELECT
  'affiliate_tracking_logs' as table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'affiliate_tracking_logs') as column_count,
  (SELECT COUNT(*) FROM affiliate_tracking_logs) as row_count;
