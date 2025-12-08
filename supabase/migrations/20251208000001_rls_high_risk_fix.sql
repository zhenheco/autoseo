-- Migration: RLS High Risk Fix
-- Description: 修復高風險表格的 RLS 安全問題
-- Phase: 1 of 3
--
-- ⚠️ 重要：此 migration 會啟用 RLS，確保先建立 Policy 再啟用 RLS
-- 否則使用 anon key 的查詢會全部失敗

-- ============================================
-- 1. generated_articles
-- 目前只有 DELETE Policy，需要新增 SELECT Policy
-- ============================================

-- 1.1 新增 SELECT Policy（用戶可查看自己公司的文章）
DROP POLICY IF EXISTS "Users can view own company articles" ON generated_articles;
CREATE POLICY "Users can view own company articles"
ON public.generated_articles FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 1.2 新增 INSERT Policy（用戶可為自己公司建立文章）
DROP POLICY IF EXISTS "Users can insert own company articles" ON generated_articles;
CREATE POLICY "Users can insert own company articles"
ON public.generated_articles FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 1.3 新增 UPDATE Policy（用戶可更新自己公司的文章）
DROP POLICY IF EXISTS "Users can update own company articles" ON generated_articles;
CREATE POLICY "Users can update own company articles"
ON public.generated_articles FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 1.4 啟用 RLS（現在 Policy 都建好了，安全啟用）
ALTER TABLE public.generated_articles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. orders
-- ============================================

-- 2.1 新增 SELECT Policy
DROP POLICY IF EXISTS "Users can view own company orders" ON orders;
CREATE POLICY "Users can view own company orders"
ON public.orders FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 2.2 啟用 RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. token_deduction_records
-- ============================================

-- 3.1 新增 SELECT Policy
DROP POLICY IF EXISTS "Users can view own company token records" ON token_deduction_records;
CREATE POLICY "Users can view own company token records"
ON public.token_deduction_records FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 3.2 啟用 RLS
ALTER TABLE public.token_deduction_records ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. 刪除不需要的備份表
-- ============================================
DROP TABLE IF EXISTS public.subscription_plans_backup;
DROP TABLE IF EXISTS public.subscriptions_backup;
