-- Migration: 自動翻譯設定
-- 在 website_configs 新增自動翻譯相關欄位

-- 新增自動翻譯啟用開關
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS auto_translate_enabled BOOLEAN DEFAULT FALSE;

-- 新增自動翻譯目標語言列表
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS auto_translate_languages TEXT[] DEFAULT '{}';

-- 為欄位加入註解
COMMENT ON COLUMN website_configs.auto_translate_enabled IS '是否啟用排程發布時自動翻譯';
COMMENT ON COLUMN website_configs.auto_translate_languages IS '自動翻譯的目標語言列表，例如：{en-US, ja-JP, ko-KR}';

-- 建立索引加速查詢啟用自動翻譯的網站
CREATE INDEX IF NOT EXISTS idx_website_configs_auto_translate
ON website_configs (auto_translate_enabled)
WHERE auto_translate_enabled = TRUE;
