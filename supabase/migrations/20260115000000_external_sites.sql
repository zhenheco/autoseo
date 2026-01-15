-- Migration: External Sites API
-- Description: 新增外部網站 API 整合功能欄位
-- Date: 2026-01-15

-- ============================================
-- 1. 新增 site_type 欄位
-- ============================================

-- site_type: 區分不同類型的網站
-- - 'wordpress': 用戶的 WordPress 網站（透過 WordPress REST API 發布）
-- - 'platform': 1wayseo.com 自營 Blog（直接寫資料庫）
-- - 'external': 外部小工具 Next.js 網站（透過 API 拉取）

ALTER TABLE public.website_configs
ADD COLUMN IF NOT EXISTS site_type TEXT DEFAULT 'wordpress'
CHECK (site_type IN ('wordpress', 'platform', 'external'));

COMMENT ON COLUMN website_configs.site_type IS '網站類型：wordpress=WordPress網站, platform=平台Blog, external=外部API整合網站';

-- ============================================
-- 2. 新增 API Key 相關欄位
-- ============================================

-- api_key: 外部網站用於認證的 API Key（格式: sk_site_xxxx）
ALTER TABLE public.website_configs
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

COMMENT ON COLUMN website_configs.api_key IS '外部網站 API Key（格式: sk_site_xxxx），用於 /api/v1/sites/* 認證';

-- api_key_created_at: API Key 建立時間（用於追蹤和審計）
ALTER TABLE public.website_configs
ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN website_configs.api_key_created_at IS 'API Key 建立時間';

-- ============================================
-- 3. 新增 is_external_site 欄位
-- ============================================

-- is_external_site: 快速判斷是否為外部網站（便於查詢）
ALTER TABLE public.website_configs
ADD COLUMN IF NOT EXISTS is_external_site BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN website_configs.is_external_site IS '是否為外部小工具網站（透過 API 整合）';

-- ============================================
-- 4. 建立索引
-- ============================================

-- API Key 查詢索引（用於認證時快速查找）
CREATE INDEX IF NOT EXISTS idx_website_configs_api_key
ON website_configs (api_key)
WHERE api_key IS NOT NULL;

-- 外部網站查詢索引
CREATE INDEX IF NOT EXISTS idx_website_configs_external_site
ON website_configs (is_external_site)
WHERE is_external_site = TRUE;

-- site_type 查詢索引
CREATE INDEX IF NOT EXISTS idx_website_configs_site_type
ON website_configs (site_type);

-- ============================================
-- 5. 更新現有資料的 site_type
-- ============================================

-- 將已存在的 platform blog 設為 'platform' 類型
UPDATE website_configs
SET site_type = 'platform'
WHERE is_platform_blog = TRUE AND site_type = 'wordpress';

-- ============================================
-- 6. RLS 政策（API Key 欄位保護）
-- ============================================

-- 注意：api_key 欄位的讀取權限已由現有 RLS 控制
-- 只有網站擁有者（透過 company_members）可以看到自己的 API Key

-- 公開 API 驗證需要用 service role key 查詢
-- 所以不需要額外的 RLS 政策
