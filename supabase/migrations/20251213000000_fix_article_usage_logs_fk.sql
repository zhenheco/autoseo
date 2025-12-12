-- =====================================================
-- 修復 article_usage_logs 外鍵約束
-- =====================================================
-- 問題：刪除 article_jobs 時因外鍵約束失敗
-- 錯誤：update or delete on table "article_jobs" violates foreign key constraint
--       "article_usage_logs_article_job_id_fkey" on table "article_usage_logs"
-- 解決：改為 ON DELETE SET NULL，保留使用記錄

-- 1. 先刪除現有約束
ALTER TABLE article_usage_logs
DROP CONSTRAINT IF EXISTS article_usage_logs_article_job_id_fkey;

-- 2. 重新添加約束，設定 ON DELETE SET NULL
-- 當 article_job 被刪除時，article_usage_logs 的 article_job_id 會被設為 NULL
-- 保留使用記錄（用於對帳和使用分析）
ALTER TABLE article_usage_logs
ADD CONSTRAINT article_usage_logs_article_job_id_fkey
FOREIGN KEY (article_job_id) REFERENCES article_jobs(id)
ON DELETE SET NULL;

-- 註解
COMMENT ON CONSTRAINT article_usage_logs_article_job_id_fkey ON article_usage_logs IS
  '關聯到 article_jobs，刪除 article_job 時會設為 NULL 以保留使用記錄';
