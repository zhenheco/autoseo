-- Migration: Public Blog RLS
-- Description: 新增 RLS 政策，允許公開讀取官方 Blog 的已發布文章
-- Date: 2025-12-14
--
-- ⚠️ 注意：此政策是「附加」的，不會影響現有的公司成員存取邏輯
-- 現有 Policy: "Users can view own company articles" 仍然有效

-- ============================================
-- 1. 新增公開文章 SELECT Policy
-- ============================================

-- 允許任何人（包括未登入用戶）讀取：
-- - status = 'published' 的文章
-- - 發布到 is_platform_blog = true 站點的文章
DROP POLICY IF EXISTS "Public can view published platform blog articles" ON generated_articles;
CREATE POLICY "Public can view published platform blog articles"
ON public.generated_articles FOR SELECT
USING (
  status = 'published' AND
  published_to_website_id IN (
    SELECT id FROM website_configs WHERE is_platform_blog = TRUE
  )
);

-- ============================================
-- 2. 新增索引加速公開文章查詢
-- ============================================

-- 複合索引：status + published_to_website_id
CREATE INDEX IF NOT EXISTS idx_generated_articles_public_blog
ON generated_articles(published_to_website_id, status)
WHERE status = 'published';

-- 索引：slug 查詢（文章詳情頁）
CREATE INDEX IF NOT EXISTS idx_generated_articles_slug
ON generated_articles(slug)
WHERE slug IS NOT NULL;

-- ============================================
-- 3. 新增 website_configs 公開讀取 Policy（讓前端能查詢 platform blog ID）
-- ============================================

-- 允許查詢 is_platform_blog = true 的站點（不包含敏感資訊）
DROP POLICY IF EXISTS "Public can view platform blog site" ON website_configs;
CREATE POLICY "Public can view platform blog site"
ON public.website_configs FOR SELECT
USING (is_platform_blog = TRUE);
