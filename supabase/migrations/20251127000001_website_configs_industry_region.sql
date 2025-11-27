-- 新增 industry 和 region 欄位到 website_configs
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS industry TEXT,
ADD COLUMN IF NOT EXISTS region TEXT DEFAULT '台灣';

COMMENT ON COLUMN website_configs.industry IS '網站所屬產業，用於文章生成時的語調和內容調整';
COMMENT ON COLUMN website_configs.region IS '目標地區，用於本地化內容生成';
