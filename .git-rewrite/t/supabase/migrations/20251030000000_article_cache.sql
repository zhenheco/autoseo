-- 文章和圖片暫存查閱系統
-- 移除 N8N 相關欄位，優化資料結構

-- 1. 清理 article_jobs 表的 N8N 相關欄位
ALTER TABLE article_jobs
DROP COLUMN IF EXISTS workflow_data,
DROP COLUMN IF EXISTS serp_analysis,
DROP COLUMN IF EXISTS competitor_analysis,
DROP COLUMN IF EXISTS content_plan,
DROP COLUMN IF EXISTS processing_stages;

-- 2. 清理 website_configs 表的 N8N 相關欄位
ALTER TABLE website_configs
DROP COLUMN IF EXISTS n8n_webhook_url,
DROP COLUMN IF EXISTS workflow_settings;

-- 3. 建立文章暫存表（用於預覽和審核）
CREATE TABLE IF NOT EXISTS article_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_job_id UUID REFERENCES article_jobs(id) ON DELETE CASCADE,

  -- 文章內容
  title TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  html_content TEXT NOT NULL,

  -- SEO 元數據
  seo_title TEXT,
  seo_description TEXT,
  slug TEXT,
  focus_keyword TEXT,
  keywords TEXT[],

  -- 分類與標籤
  categories TEXT[],
  tags TEXT[],

  -- 圖片資訊
  featured_image_url TEXT,
  featured_image_alt TEXT,
  content_images JSONB DEFAULT '[]',

  -- 統計資訊
  word_count INTEGER,
  reading_time INTEGER,
  quality_score INTEGER,

  -- 狀態
  status TEXT DEFAULT 'draft', -- draft, approved, rejected, published
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 4. 建立圖片暫存表
CREATE TABLE IF NOT EXISTS image_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_cache_id UUID REFERENCES article_cache(id) ON DELETE CASCADE,

  -- 圖片資訊
  image_url TEXT NOT NULL,
  image_type TEXT NOT NULL, -- featured, content, thumbnail
  alt_text TEXT,
  caption TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,

  -- 元數據
  generated_by TEXT, -- ai, upload, url
  generation_prompt TEXT,
  source_url TEXT,

  -- 狀態
  status TEXT DEFAULT 'pending', -- pending, approved, rejected

  -- 時間戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- 5. 建立索引
CREATE INDEX IF NOT EXISTS idx_article_cache_job_id ON article_cache(article_job_id);
CREATE INDEX IF NOT EXISTS idx_article_cache_status ON article_cache(status);
CREATE INDEX IF NOT EXISTS idx_article_cache_expires ON article_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_image_cache_article_id ON image_cache(article_cache_id);
CREATE INDEX IF NOT EXISTS idx_image_cache_status ON image_cache(status);

-- 6. 自動更新 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_article_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER article_cache_updated_at
  BEFORE UPDATE ON article_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_article_cache_updated_at();

-- 7. 自動清理過期暫存的函數
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  -- 刪除過期的文章暫存
  DELETE FROM article_cache
  WHERE expires_at < NOW() AND status = 'draft';

  -- 刪除過期的圖片暫存（會因為 CASCADE 自動刪除關聯的圖片）
  DELETE FROM image_cache
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 8. 註解
COMMENT ON TABLE article_cache IS '文章暫存表，用於預覽和審核';
COMMENT ON TABLE image_cache IS '圖片暫存表，用於預覽和管理';
COMMENT ON COLUMN article_cache.expires_at IS '過期時間，預設 7 天後自動清理';
COMMENT ON COLUMN article_cache.status IS '狀態: draft(草稿), approved(已批准), rejected(已拒絕), published(已發布)';
COMMENT ON FUNCTION cleanup_expired_cache IS '清理過期的暫存資料，建議定期執行';
