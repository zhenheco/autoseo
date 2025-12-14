-- ===========================================
-- Article Translations (文章翻譯表)
-- 儲存原創文章的多語言翻譯版本
-- ===========================================

CREATE TABLE article_translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 關聯原文
  source_article_id UUID REFERENCES generated_articles(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  website_id UUID REFERENCES website_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- 語言資訊
  source_language TEXT NOT NULL DEFAULT 'zh-TW',
  target_language TEXT NOT NULL,  -- 'en-US', 'de-DE', 'fr-FR', 'es-ES'

  -- 翻譯內容
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  html_content TEXT NOT NULL,
  excerpt TEXT,

  -- 翻譯 SEO Metadata
  seo_title TEXT,
  seo_description TEXT,
  focus_keyword TEXT,
  keywords TEXT[] DEFAULT '{}',

  -- Open Graph & Twitter Card（翻譯）
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,

  -- 分類與標籤（翻譯）
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- 統計（重新計算）
  word_count INTEGER,
  reading_time INTEGER, -- 閱讀時間（分鐘）
  paragraph_count INTEGER,
  sentence_count INTEGER,

  -- 連結資訊（保持原文連結結構）
  internal_links JSONB DEFAULT '[]',
  internal_links_count INTEGER DEFAULT 0,
  external_references JSONB DEFAULT '[]',
  external_links_count INTEGER DEFAULT 0,

  -- 品質與審核
  translation_quality_score DECIMAL(5,2),
  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,

  -- AI 模型資訊
  translation_model TEXT,
  translation_tokens JSONB, -- {input: number, output: number}
  translation_cost DECIMAL(10,4),
  translation_time INTEGER, -- 翻譯時間（秒）

  -- 狀態
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- 確保每篇文章每個語言只有一個翻譯
  UNIQUE(source_article_id, target_language)
);

-- 索引優化
CREATE INDEX idx_translations_source ON article_translations(source_article_id);
CREATE INDEX idx_translations_company ON article_translations(company_id);
CREATE INDEX idx_translations_website ON article_translations(website_id);
CREATE INDEX idx_translations_user ON article_translations(user_id);
CREATE INDEX idx_translations_language ON article_translations(target_language);
CREATE INDEX idx_translations_status ON article_translations(status);
CREATE INDEX idx_translations_slug ON article_translations(slug);
CREATE INDEX idx_translations_slug_lang ON article_translations(slug, target_language);
CREATE INDEX idx_translations_keywords ON article_translations USING GIN(keywords);
CREATE INDEX idx_translations_categories ON article_translations USING GIN(categories);
CREATE INDEX idx_translations_tags ON article_translations USING GIN(tags);

-- 全文搜索索引
CREATE INDEX idx_translations_title_search ON article_translations USING GIN(to_tsvector('simple', title));
CREATE INDEX idx_translations_content_search ON article_translations USING GIN(to_tsvector('simple', markdown_content));

-- 複合索引（用於查詢特定語言的文章）
CREATE INDEX idx_translations_website_lang ON article_translations(website_id, target_language);
CREATE INDEX idx_translations_website_status_lang ON article_translations(website_id, status, target_language);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_translations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_translations_updated_at
  BEFORE UPDATE ON article_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_translations_updated_at();

-- ===========================================
-- Translation Jobs (翻譯任務表)
-- 追蹤批量翻譯任務狀態
-- ===========================================

CREATE TABLE translation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id TEXT UNIQUE NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  website_id UUID REFERENCES website_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- 來源文章
  source_article_id UUID REFERENCES generated_articles(id) ON DELETE CASCADE,

  -- 目標語言（支援批量翻譯）
  target_languages TEXT[] NOT NULL,  -- ['en-US', 'de-DE', 'fr-FR', 'es-ES']

  -- 狀態追蹤
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0,  -- 0-100
  current_language TEXT,  -- 當前正在處理的語言

  -- 結果
  completed_languages TEXT[] DEFAULT '{}',
  failed_languages JSONB DEFAULT '{}',  -- {"de-DE": "error message"}

  -- 元資料
  metadata JSONB DEFAULT '{}',
  error_message TEXT,

  -- 時間追蹤
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 索引優化
CREATE INDEX idx_translation_jobs_company ON translation_jobs(company_id);
CREATE INDEX idx_translation_jobs_website ON translation_jobs(website_id);
CREATE INDEX idx_translation_jobs_user ON translation_jobs(user_id);
CREATE INDEX idx_translation_jobs_source ON translation_jobs(source_article_id);
CREATE INDEX idx_translation_jobs_status ON translation_jobs(status);
CREATE INDEX idx_translation_jobs_created ON translation_jobs(created_at DESC);

-- 用於 GitHub Actions 查詢 pending 任務的複合索引
CREATE INDEX idx_translation_jobs_pending ON translation_jobs(status, started_at)
  WHERE status IN ('pending', 'processing');

-- ===========================================
-- 支援的翻譯語言配置（可擴充）
-- ===========================================

CREATE TABLE IF NOT EXISTS supported_translation_languages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale TEXT UNIQUE NOT NULL,  -- 'en-US', 'de-DE'
  name TEXT NOT NULL,           -- 'English (US)', 'German'
  native_name TEXT NOT NULL,    -- 'English', 'Deutsch'
  flag_emoji TEXT,              -- unicode flag
  is_enabled BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 預設支援的語言
INSERT INTO supported_translation_languages (locale, name, native_name, flag_emoji, display_order) VALUES
  ('en-US', 'English (US)', 'English', '🇺🇸', 1),
  ('de-DE', 'German', 'Deutsch', '🇩🇪', 2),
  ('fr-FR', 'French', 'Français', '🇫🇷', 3),
  ('es-ES', 'Spanish', 'Español', '🇪🇸', 4)
ON CONFLICT (locale) DO NOTHING;

-- ===========================================
-- RLS Policies
-- ===========================================

ALTER TABLE article_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supported_translation_languages ENABLE ROW LEVEL SECURITY;

-- article_translations policies
CREATE POLICY "Users can view translations for their company"
  ON article_translations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert translations for their company"
  ON article_translations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update translations for their company"
  ON article_translations FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete translations for their company"
  ON article_translations FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

-- translation_jobs policies
CREATE POLICY "Users can view translation jobs for their company"
  ON translation_jobs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert translation jobs for their company"
  ON translation_jobs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update translation jobs for their company"
  ON translation_jobs FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    OR company_id IN (
      SELECT id FROM companies WHERE owner_id = auth.uid()
    )
  );

-- supported_translation_languages policies（所有人可讀）
CREATE POLICY "Anyone can view supported languages"
  ON supported_translation_languages FOR SELECT
  USING (true);

-- ===========================================
-- 輔助函數：獲取文章的所有翻譯版本
-- ===========================================

CREATE OR REPLACE FUNCTION get_article_translations(
  article_id UUID
)
RETURNS TABLE(
  translation_id UUID,
  target_language TEXT,
  title TEXT,
  slug TEXT,
  status TEXT,
  published_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    at.id,
    at.target_language,
    at.title,
    at.slug,
    at.status,
    at.published_at
  FROM article_translations at
  WHERE at.source_article_id = article_id
  ORDER BY at.target_language;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 輔助函數：獲取文章的 hreflang 資訊
-- ===========================================

CREATE OR REPLACE FUNCTION get_article_hreflang(
  article_id UUID,
  base_url TEXT DEFAULT 'https://1wayseo.com'
)
RETURNS TABLE(
  locale TEXT,
  url TEXT
) AS $$
BEGIN
  -- 原文（中文）
  RETURN QUERY
  SELECT
    'zh-TW'::TEXT,
    base_url || '/blog/zh-TW/' || ga.slug
  FROM generated_articles ga
  WHERE ga.id = article_id;

  -- 所有翻譯版本
  RETURN QUERY
  SELECT
    at.target_language,
    base_url || '/blog/' || at.target_language || '/' || at.slug
  FROM article_translations at
  WHERE at.source_article_id = article_id
    AND at.status = 'published';
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- Comments
-- ===========================================

COMMENT ON TABLE article_translations IS '儲存原創文章的多語言翻譯版本';
COMMENT ON TABLE translation_jobs IS '追蹤批量翻譯任務狀態';
COMMENT ON TABLE supported_translation_languages IS '系統支援的翻譯目標語言配置';
COMMENT ON FUNCTION get_article_translations IS '獲取指定文章的所有翻譯版本';
COMMENT ON FUNCTION get_article_hreflang IS '獲取文章的 hreflang SEO 資訊';
