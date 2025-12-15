-- ===========================================
-- Translation Scheduling (翻譯版本排程功能)
-- 讓同一篇文章的所有語系版本可以同時發布
-- ===========================================

-- 1. 為 article_translations 新增排程相關欄位
ALTER TABLE article_translations ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE article_translations ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN DEFAULT false;
ALTER TABLE article_translations ADD COLUMN IF NOT EXISTS publish_website_id UUID REFERENCES website_configs(id);

-- 2. 建立索引（用於 cron job 查詢待發布的翻譯）
CREATE INDEX IF NOT EXISTS idx_translations_scheduled
  ON article_translations(scheduled_publish_at, status, auto_publish)
  WHERE scheduled_publish_at IS NOT NULL AND auto_publish = true;

-- 3. 建立索引（用於查詢特定文章的所有排程翻譯）
CREATE INDEX IF NOT EXISTS idx_translations_source_scheduled
  ON article_translations(source_article_id, scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;

-- ===========================================
-- 輔助函數：同時排程原文和所有翻譯版本
-- ===========================================

CREATE OR REPLACE FUNCTION schedule_article_with_translations(
  p_article_id UUID,           -- generated_articles.id
  p_scheduled_at TIMESTAMP WITH TIME ZONE,
  p_website_id UUID,
  p_auto_publish BOOLEAN DEFAULT true
)
RETURNS TABLE(
  type TEXT,
  id UUID,
  language TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  -- 更新所有翻譯版本的排程時間（與原文相同時間）
  UPDATE article_translations
  SET
    scheduled_publish_at = p_scheduled_at,
    auto_publish = p_auto_publish,
    publish_website_id = p_website_id,
    updated_at = NOW()
  WHERE source_article_id = p_article_id
    AND status IN ('draft', 'reviewed');  -- 只排程未發布的翻譯

  -- 返回已排程的項目
  RETURN QUERY
  SELECT
    'original'::TEXT AS type,
    p_article_id AS id,
    'zh-TW'::TEXT AS language,
    p_scheduled_at AS scheduled_at;

  RETURN QUERY
  SELECT
    'translation'::TEXT AS type,
    at.id AS id,
    at.target_language AS language,
    at.scheduled_publish_at AS scheduled_at
  FROM article_translations at
  WHERE at.source_article_id = p_article_id
    AND at.scheduled_publish_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 輔助函數：取得待發布的翻譯（供 cron job 使用）
-- ===========================================

CREATE OR REPLACE FUNCTION get_pending_translation_publishes(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  translation_id UUID,
  source_article_id UUID,
  target_language TEXT,
  title TEXT,
  slug TEXT,
  publish_website_id UUID,
  scheduled_publish_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    at.id,
    at.source_article_id,
    at.target_language,
    at.title,
    at.slug,
    at.publish_website_id,
    at.scheduled_publish_at
  FROM article_translations at
  WHERE at.auto_publish = true
    AND at.scheduled_publish_at <= NOW()
    AND at.status IN ('draft', 'reviewed')  -- 尚未發布
  ORDER BY at.scheduled_publish_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 輔助函數：發布翻譯版本
-- ===========================================

CREATE OR REPLACE FUNCTION publish_translation(
  p_translation_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE article_translations
  SET
    status = 'published',
    published_at = NOW(),
    auto_publish = false,  -- 發布後關閉自動發布
    updated_at = NOW()
  WHERE id = p_translation_id
    AND status IN ('draft', 'reviewed');

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 輔助函數：取消翻譯排程
-- ===========================================

CREATE OR REPLACE FUNCTION cancel_translation_schedule(
  p_source_article_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  UPDATE article_translations
  SET
    scheduled_publish_at = NULL,
    auto_publish = false,
    publish_website_id = NULL,
    updated_at = NOW()
  WHERE source_article_id = p_source_article_id
    AND scheduled_publish_at IS NOT NULL;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Comments
-- ===========================================

COMMENT ON COLUMN article_translations.scheduled_publish_at IS '排程發布時間（與原文同步）';
COMMENT ON COLUMN article_translations.auto_publish IS '是否自動發布（由 cron job 處理）';
COMMENT ON COLUMN article_translations.publish_website_id IS '發布目標網站 ID';
COMMENT ON FUNCTION schedule_article_with_translations IS '同時排程原文和所有翻譯版本到相同時間點';
COMMENT ON FUNCTION get_pending_translation_publishes IS '取得待發布的翻譯（供 cron job 使用）';
COMMENT ON FUNCTION publish_translation IS '發布單一翻譯版本';
COMMENT ON FUNCTION cancel_translation_schedule IS '取消指定原文的所有翻譯排程';
