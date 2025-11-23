-- 修正 article_jobs 表的 job_id 欄位
-- job_id 應該是可選的，並自動生成

-- 1. 移除 NOT NULL 約束
ALTER TABLE article_jobs ALTER COLUMN job_id DROP NOT NULL;

-- 2. 修改 job_id 預設值，自動生成唯一 ID
ALTER TABLE article_jobs ALTER COLUMN job_id SET DEFAULT gen_random_uuid()::text;

-- 3. 為現有沒有 job_id 的記錄生成 ID
UPDATE article_jobs SET job_id = gen_random_uuid()::text WHERE job_id IS NULL;

COMMENT ON COLUMN article_jobs.job_id IS '任務 ID（自動生成，用於追蹤和 N8N 整合）';
