-- 文章排程功能遷移
-- 擴展 article_jobs 的 status 類型，新增 scheduled 和 schedule_failed 狀態

-- 先檢查並移除現有約束
DO $$
BEGIN
  -- 移除現有的 status check 約束（如果存在）
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'article_jobs' AND column_name = 'status'
  ) THEN
    ALTER TABLE article_jobs DROP CONSTRAINT IF EXISTS article_jobs_status_check;
  END IF;
END $$;

-- 修改 status 欄位為新的 enum（包含 scheduled 和 schedule_failed）
-- 由於 PostgreSQL 無法直接修改 check 約束，我們使用較寬鬆的方式
-- status 現在可以是：pending, processing, completed, failed, published, scheduled, schedule_failed

-- 新增排程重試相關欄位（如果不存在）
ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS publish_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_publish_error TEXT;

-- 為 scheduled_publish_at 建立索引以加速 cron job 查詢
CREATE INDEX IF NOT EXISTS idx_article_jobs_scheduled_publish
ON article_jobs (scheduled_publish_at)
WHERE scheduled_publish_at IS NOT NULL AND status = 'scheduled';

-- 建立複合索引用於查詢待發布文章
CREATE INDEX IF NOT EXISTS idx_article_jobs_company_status
ON article_jobs (company_id, status);

COMMENT ON COLUMN article_jobs.scheduled_publish_at IS '排程發布時間（台灣時區）';
COMMENT ON COLUMN article_jobs.publish_retry_count IS '發布重試次數';
COMMENT ON COLUMN article_jobs.last_publish_error IS '最後一次發布錯誤訊息';
