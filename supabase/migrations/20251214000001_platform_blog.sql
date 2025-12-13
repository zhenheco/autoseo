-- Migration: Platform Blog
-- Description: 新增 is_platform_blog 欄位，標記官方 Blog 站點
-- Date: 2025-12-14

-- ============================================
-- 1. 新增 is_platform_blog 欄位
-- ============================================

ALTER TABLE public.website_configs
ADD COLUMN IF NOT EXISTS is_platform_blog BOOLEAN DEFAULT FALSE;

-- 加上註解說明用途
COMMENT ON COLUMN website_configs.is_platform_blog IS '標記此站點為平台官方 Blog，文章將公開顯示在 /blog';

-- ============================================
-- 2. 確保只有一個官方 Blog 站點
-- 使用 partial unique index
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_configs_platform_blog_unique
ON website_configs (is_platform_blog)
WHERE is_platform_blog = TRUE;

-- ============================================
-- 3. 建立索引加速查詢
-- ============================================

CREATE INDEX IF NOT EXISTS idx_website_configs_platform_blog
ON website_configs (is_platform_blog)
WHERE is_platform_blog = TRUE;
