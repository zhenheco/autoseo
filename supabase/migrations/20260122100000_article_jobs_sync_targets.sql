-- Migration: 新增 article_jobs.sync_target_ids 欄位
-- 用於排程發布時選擇同步目標

ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS sync_target_ids JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN article_jobs.sync_target_ids IS
  'Array of sync_target IDs to sync when article is published via scheduled job';

-- 建立 GIN 索引以優化 JSONB 查詢
CREATE INDEX IF NOT EXISTS idx_article_jobs_sync_target_ids
ON article_jobs USING GIN (sync_target_ids);
