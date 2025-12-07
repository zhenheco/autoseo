-- 修復：添加 article_job_id unique constraint
-- 問題：代碼使用 onConflict: "article_job_id"，但只有 partial unique index
-- 解決：添加真正的 unique constraint 以支援 PostgreSQL ON CONFLICT

-- 先刪除 partial index（如果不再需要可以保留，但不影響功能）
-- DROP INDEX IF EXISTS idx_generated_articles_job_id_unique;

-- 添加 unique constraint（如果已存在則跳過）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'generated_articles_article_job_id_unique'
    ) THEN
        ALTER TABLE generated_articles
        ADD CONSTRAINT generated_articles_article_job_id_unique
        UNIQUE (article_job_id);
    END IF;
END $$;
