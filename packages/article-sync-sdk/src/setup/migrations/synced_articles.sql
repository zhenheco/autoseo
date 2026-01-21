-- =============================================
-- Migration: synced_articles
-- 同步文章表（供外部專案使用）
-- 來自 @1wayseo/article-sync-sdk
-- =============================================

-- 創建 synced_articles 表
CREATE TABLE IF NOT EXISTS synced_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 來源識別
  source_id TEXT NOT NULL UNIQUE,        -- 1waySEO 的 article ID
  slug TEXT NOT NULL,

  -- 內容
  title TEXT NOT NULL,
  excerpt TEXT,
  html_content TEXT,
  markdown_content TEXT,

  -- 分類和標籤
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- 多語系
  language TEXT NOT NULL DEFAULT 'zh-TW',

  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  focus_keyword TEXT,
  keywords TEXT[] DEFAULT '{}',

  -- 媒體
  featured_image_url TEXT,
  featured_image_alt TEXT,

  -- 閱讀資訊
  word_count INTEGER,
  reading_time INTEGER,

  -- 時間戳記
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 同步狀態
  sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'deleted'))
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_synced_articles_slug ON synced_articles(slug);
CREATE INDEX IF NOT EXISTS idx_synced_articles_source_id ON synced_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_synced_articles_language ON synced_articles(language);
CREATE INDEX IF NOT EXISTS idx_synced_articles_status ON synced_articles(sync_status);
CREATE INDEX IF NOT EXISTS idx_synced_articles_published_at ON synced_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_synced_articles_categories ON synced_articles USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_synced_articles_tags ON synced_articles USING GIN(tags);

-- 創建 updated_at 觸發器
CREATE OR REPLACE FUNCTION update_synced_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_synced_articles_updated_at ON synced_articles;
CREATE TRIGGER trigger_synced_articles_updated_at
  BEFORE UPDATE ON synced_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_synced_articles_updated_at();

-- RLS 政策（可選：根據需求調整）
ALTER TABLE synced_articles ENABLE ROW LEVEL SECURITY;

-- 公開讀取：所有人可以查看已發布的文章
CREATE POLICY "Public can read active articles" ON synced_articles
  FOR SELECT
  USING (sync_status = 'active');

-- Service role 可以執行所有操作（用於 webhook 處理）
-- 這是通過 service_role key 繞過 RLS 實現的

-- 添加註解
COMMENT ON TABLE synced_articles IS '同步自 1waySEO 的文章';
COMMENT ON COLUMN synced_articles.source_id IS '1waySEO 的文章 ID';
COMMENT ON COLUMN synced_articles.sync_status IS '同步狀態：active（有效）、deleted（已刪除）';
