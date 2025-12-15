-- =====================================================
-- Migration: 網站自動排程設定
-- 新增 daily_article_limit 和 auto_schedule_enabled 欄位
-- =====================================================

-- 每日發布文章數上限（預設 3 篇）
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS daily_article_limit INTEGER DEFAULT 3;

-- 自動排程開關（預設關閉）
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS auto_schedule_enabled BOOLEAN DEFAULT FALSE;

-- 限制每日發布數量範圍 1-3 篇
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'website_configs_daily_article_limit_check'
  ) THEN
    ALTER TABLE website_configs
    ADD CONSTRAINT website_configs_daily_article_limit_check
    CHECK (daily_article_limit >= 1 AND daily_article_limit <= 3);
  END IF;
END $$;

-- 索引優化：快速查詢啟用自動排程的網站
CREATE INDEX IF NOT EXISTS idx_website_configs_auto_schedule
ON website_configs(id, auto_schedule_enabled)
WHERE auto_schedule_enabled = TRUE;

-- 欄位註解
COMMENT ON COLUMN website_configs.daily_article_limit IS '每日發布文章數上限（1-3 篇）';
COMMENT ON COLUMN website_configs.auto_schedule_enabled IS '是否啟用自動排程（文章生成後自動排入發布佇列）';
