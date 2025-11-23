-- ===========================================
-- Restructure Article Workflow Migration
-- 支援文章後期網站分配機制
-- ===========================================

-- 新增發布資訊欄位
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS published_to_website_id UUID REFERENCES website_configs(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS published_to_website_at TIMESTAMP WITH TIME ZONE;

-- 確保 website_id 允許 NULL（以支援創建時不綁定網站）
ALTER TABLE generated_articles
ALTER COLUMN website_id DROP NOT NULL;

-- 建立索引加速查詢已發布文章
CREATE INDEX IF NOT EXISTS idx_articles_published_website
ON generated_articles(published_to_website_id)
WHERE published_to_website_id IS NOT NULL;

-- 建立複合索引（用於查詢特定網站的已發布文章）
CREATE INDEX IF NOT EXISTS idx_articles_published_website_status
ON generated_articles(published_to_website_id, status)
WHERE published_to_website_id IS NOT NULL;

-- 資料遷移：將現有已發布文章的 website_id 複製到 published_to_website_id
UPDATE generated_articles
SET
  published_to_website_id = website_id,
  published_to_website_at = COALESCE(published_at, created_at)
WHERE
  status = 'published'
  AND website_id IS NOT NULL
  AND published_to_website_id IS NULL;

-- 註解說明
COMMENT ON COLUMN generated_articles.website_id IS '(已棄用，保留向後相容) 原本創建時綁定的網站 ID，允許 NULL';
COMMENT ON COLUMN generated_articles.published_to_website_id IS '實際發布到的網站 ID，在發布時才指定';
COMMENT ON COLUMN generated_articles.published_to_website_at IS '發布到網站的時間戳記';
