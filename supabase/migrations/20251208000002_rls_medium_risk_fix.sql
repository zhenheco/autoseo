-- Migration: RLS Medium Risk Fix
-- Description: 修復中風險表格的 RLS 安全問題
-- Phase: 2 of 3
--
-- 這些表格主要透過 service_role 存取，啟用 RLS 但不建立 Policy
-- 表示只有 service_role 可存取

-- ============================================
-- 1. article_recommendations
-- 沒有直接的 company_id，透過 source_article_id 關聯
-- ============================================

-- 1.1 新增 SELECT Policy（透過關聯表格查詢 company_id）
DROP POLICY IF EXISTS "Users can view own company recommendations" ON article_recommendations;
CREATE POLICY "Users can view own company recommendations"
ON public.article_recommendations FOR SELECT
USING (
  source_article_id IN (
    SELECT id FROM generated_articles
    WHERE company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- 1.2 啟用 RLS
ALTER TABLE public.article_recommendations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. article_cache
-- 暫存表，只透過 service_role 存取
-- 啟用 RLS 但不建立 Policy = 只有 service_role 可存取
-- ============================================
ALTER TABLE public.article_cache ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. image_cache
-- 暫存表，只透過 service_role 存取
-- ============================================
ALTER TABLE public.image_cache ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. role_permissions
-- 權限定義表，所有人可讀取
-- ============================================

DROP POLICY IF EXISTS "Anyone can read role permissions" ON role_permissions;
CREATE POLICY "Anyone can read role permissions"
ON public.role_permissions FOR SELECT
USING (true);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
