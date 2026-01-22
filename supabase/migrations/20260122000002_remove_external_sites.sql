-- Migration: Remove External Sites Feature
-- Description: 移除外部網站（API 整合）功能，因為文章同步 SDK 已提供更完整的解決方案
-- Date: 2026-01-22

-- ============================================
-- 1. 先刪除外部網站記錄
-- ============================================

-- 刪除所有外部網站的記錄（is_external_site = true 或 site_type = 'external'）
DELETE FROM public.website_configs
WHERE is_external_site = TRUE OR site_type = 'external';

-- ============================================
-- 2. 刪除外部網站 API 日誌相關結構
-- ============================================

-- 刪除視圖
DROP VIEW IF EXISTS public.external_site_api_daily_stats;

-- 刪除表格（CASCADE 會自動處理 RLS 政策和索引）
DROP TABLE IF EXISTS public.external_site_api_logs CASCADE;

-- ============================================
-- 3. 移除 website_configs 的外部網站相關索引
-- ============================================

DROP INDEX IF EXISTS idx_website_configs_api_key;
DROP INDEX IF EXISTS idx_website_configs_external_site;

-- ============================================
-- 4. 移除 website_configs 的外部網站相關欄位
-- ============================================

-- 移除 is_external_site 欄位
ALTER TABLE public.website_configs
DROP COLUMN IF EXISTS is_external_site;

-- 移除 api_key 欄位
ALTER TABLE public.website_configs
DROP COLUMN IF EXISTS api_key;

-- 移除 api_key_created_at 欄位
ALTER TABLE public.website_configs
DROP COLUMN IF EXISTS api_key_created_at;

-- ============================================
-- 5. 更新 site_type CHECK 約束
-- ============================================

-- 移除舊的 CHECK 約束（可能名稱不同，所以用多種可能的名稱嘗試）
ALTER TABLE public.website_configs
DROP CONSTRAINT IF EXISTS website_configs_site_type_check;

ALTER TABLE public.website_configs
DROP CONSTRAINT IF EXISTS site_type_check;

-- 新增更新後的 CHECK 約束（僅保留 wordpress 和 platform）
ALTER TABLE public.website_configs
ADD CONSTRAINT website_configs_site_type_check
CHECK (site_type IS NULL OR site_type IN ('wordpress', 'platform'));

-- 更新註解
COMMENT ON COLUMN website_configs.site_type IS '網站類型：wordpress=WordPress網站, platform=平台Blog';

-- ============================================
-- 驗證
-- ============================================

-- 檢查是否還有外部網站記錄（應該為 0）
DO $$
DECLARE
    external_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO external_count
    FROM website_configs
    WHERE site_type = 'external';

    IF external_count > 0 THEN
        RAISE NOTICE '警告：仍有 % 筆外部網站記錄未被清理', external_count;
    ELSE
        RAISE NOTICE '成功：所有外部網站記錄已清理';
    END IF;
END $$;
