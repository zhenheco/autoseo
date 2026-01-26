-- =============================================
-- Migration: external_websites
-- 將外部網站（原 sync_targets）統一到 website_configs
-- 新增 website_type 區分網站類型，遷移資料並更新 FK
-- =============================================

-- Step 1: 新增 website_type 欄位
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS
  website_type TEXT DEFAULT 'wordpress'
  CHECK (website_type IN ('wordpress', 'platform_blog', 'external'));

-- Step 2: 外部網站 webhook 相關欄位
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS webhook_url TEXT;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS webhook_secret TEXT;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS sync_on_publish BOOLEAN DEFAULT true;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS sync_on_update BOOLEAN DEFAULT true;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS sync_on_unpublish BOOLEAN DEFAULT true;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS sync_translations BOOLEAN DEFAULT true;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS sync_languages TEXT[] DEFAULT ARRAY['zh-TW', 'en-US'];

-- Step 3: 同步狀態追蹤欄位
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS last_sync_status TEXT;
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS last_sync_error TEXT;

-- Step 4: 外部網站的識別用 slug
ALTER TABLE website_configs ADD COLUMN IF NOT EXISTS external_slug TEXT;

-- Step 5: 更新現有資料的 website_type
UPDATE website_configs
SET website_type = 'platform_blog'
WHERE is_platform_blog = true AND website_type IS NULL;

UPDATE website_configs
SET website_type = 'wordpress'
WHERE website_type IS NULL AND (is_platform_blog IS NULL OR is_platform_blog = false);

-- Step 6: 遷移 sync_targets 資料到 website_configs
-- 使用 Ace 的公司 ID 作為 company_id（這是目前唯一使用 sync_targets 的公司）
INSERT INTO website_configs (
  company_id,
  website_name,
  wordpress_url,
  website_type,
  webhook_url,
  webhook_secret,
  sync_on_publish,
  sync_on_update,
  sync_on_unpublish,
  sync_translations,
  sync_languages,
  is_active,
  last_synced_at,
  last_sync_status,
  last_sync_error,
  external_slug,
  created_at,
  updated_at
)
SELECT
  '1c9c2d1d-3b26-4ab1-971f-98a980fdbce9',  -- Ace 的公司 ID
  name,
  'external://' || slug,  -- 使用 external:// 前綴標記為外部網站
  'external',
  webhook_url,
  webhook_secret,
  sync_on_publish,
  sync_on_update,
  sync_on_unpublish,
  sync_translations,
  sync_languages,
  is_active,
  last_synced_at,
  last_sync_status,
  last_sync_error,
  slug,  -- 保存原 slug 用於識別
  created_at,
  updated_at
FROM sync_targets
WHERE NOT EXISTS (
  SELECT 1 FROM website_configs wc
  WHERE wc.external_slug = sync_targets.slug
);

-- Step 7: 新增 article_sync_logs 的 external_website_id 欄位
ALTER TABLE article_sync_logs ADD COLUMN IF NOT EXISTS external_website_id UUID;

-- Step 8: 遷移 article_sync_logs 的 FK 資料
-- 將 sync_target_id 映射到新的 website_configs.id
UPDATE article_sync_logs asl
SET external_website_id = wc.id
FROM sync_targets st
JOIN website_configs wc ON wc.external_slug = st.slug
WHERE asl.sync_target_id = st.id
  AND asl.external_website_id IS NULL;

-- Step 9: 添加 external_website_id 的 FK 約束（如果不存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'article_sync_logs_external_website_id_fkey'
    AND table_name = 'article_sync_logs'
  ) THEN
    ALTER TABLE article_sync_logs
      ADD CONSTRAINT article_sync_logs_external_website_id_fkey
      FOREIGN KEY (external_website_id)
      REFERENCES website_configs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Step 10: 為 external_slug 建立索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_website_configs_external_slug
  ON website_configs(external_slug)
  WHERE external_slug IS NOT NULL;

-- Step 11: 為 website_type 建立索引
CREATE INDEX IF NOT EXISTS idx_website_configs_type
  ON website_configs(website_type);

-- Step 12: 建立複合索引用於查詢外部網站
CREATE INDEX IF NOT EXISTS idx_website_configs_external_active
  ON website_configs(company_id, website_type, is_active)
  WHERE website_type = 'external' AND is_active = true;

-- 添加註解
COMMENT ON COLUMN website_configs.website_type IS '網站類型：wordpress（WordPress 網站）、platform_blog（平台官方 Blog）、external（外部網站，透過 webhook 同步）';
COMMENT ON COLUMN website_configs.webhook_url IS '外部網站的 webhook URL，用於接收文章同步';
COMMENT ON COLUMN website_configs.webhook_secret IS 'HMAC-SHA256 簽章密鑰，用於驗證 webhook 請求';
COMMENT ON COLUMN website_configs.sync_on_publish IS '發布文章時是否自動同步';
COMMENT ON COLUMN website_configs.sync_on_update IS '更新文章時是否自動同步';
COMMENT ON COLUMN website_configs.sync_on_unpublish IS '取消發布時是否同步刪除';
COMMENT ON COLUMN website_configs.sync_translations IS '是否同步翻譯版本';
COMMENT ON COLUMN website_configs.sync_languages IS '要同步的語言列表';
COMMENT ON COLUMN website_configs.external_slug IS '外部網站的識別用 slug（從 sync_targets 遷移）';
