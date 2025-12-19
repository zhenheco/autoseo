-- 修復 RPC 函數的 search_path 問題
-- 問題：所有計費相關的 RPC 函數都有 search_path="" (空)
-- 導致 PostgreSQL 無法找到 company_subscriptions 等表

-- 修復 deduct_article_quota
ALTER FUNCTION public.deduct_article_quota(UUID, UUID, UUID, TEXT, TEXT[])
SET search_path = public;

-- 修復 deduct_tokens_atomic
ALTER FUNCTION public.deduct_tokens_atomic(TEXT, UUID, UUID, INTEGER)
SET search_path = public;

-- 修復 reset_monthly_quota_if_needed
ALTER FUNCTION public.reset_monthly_quota_if_needed(UUID)
SET search_path = public;

-- 驗證修復
DO $$
BEGIN
  RAISE NOTICE 'RPC search_path 已修復';
END $$;
