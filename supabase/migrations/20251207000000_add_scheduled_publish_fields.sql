-- 新增排程發佈相關欄位
-- 這些欄位用於支援延遲 WordPress 發佈功能

-- 新增排程發佈時間
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ;

-- 新增用戶選擇的 WordPress 發佈狀態
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS target_wordpress_status TEXT DEFAULT 'publish';

-- 新增發佈重試追蹤
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS publish_retry_count INTEGER DEFAULT 0;

ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS last_publish_error TEXT;

-- 新增約束確保狀態值有效
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'generated_articles_target_wordpress_status_check'
  ) THEN
    ALTER TABLE generated_articles
    ADD CONSTRAINT generated_articles_target_wordpress_status_check
    CHECK (target_wordpress_status IS NULL OR target_wordpress_status IN ('draft', 'publish'));
  END IF;
END $$;

-- 優化查詢索引：用於查詢待發佈的排程文章
CREATE INDEX IF NOT EXISTS idx_generated_articles_scheduled_publish
ON generated_articles(scheduled_publish_at, target_wordpress_status)
WHERE scheduled_publish_at IS NOT NULL
  AND wordpress_post_id IS NULL;

-- 添加欄位註解
COMMENT ON COLUMN generated_articles.target_wordpress_status IS '用戶選擇的 WordPress 發佈狀態：draft 或 publish';
COMMENT ON COLUMN generated_articles.publish_retry_count IS '發佈重試次數';
COMMENT ON COLUMN generated_articles.last_publish_error IS '最後一次發佈錯誤訊息';
