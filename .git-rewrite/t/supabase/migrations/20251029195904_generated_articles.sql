-- ===========================================
-- Generated Articles (生成文章內容表)
-- 用於儲存完整的生成文章，支援內部連結推薦
-- ===========================================

CREATE TABLE generated_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_job_id UUID REFERENCES article_jobs(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  website_id UUID REFERENCES website_configs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- 文章內容
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  markdown_content TEXT NOT NULL,
  html_content TEXT NOT NULL,
  excerpt TEXT,

  -- SEO Metadata
  seo_title TEXT,
  seo_description TEXT,
  focus_keyword TEXT,
  keywords TEXT[] DEFAULT '{}',
  
  -- Open Graph & Twitter Card
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  twitter_card_type TEXT,
  twitter_title TEXT,
  twitter_description TEXT,
  twitter_image TEXT,

  -- 分類與標籤
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- 文章統計
  word_count INTEGER,
  reading_time INTEGER, -- 閱讀時間（分鐘）
  paragraph_count INTEGER,
  sentence_count INTEGER,

  -- 可讀性指標
  flesch_reading_ease DECIMAL(5,2),
  flesch_kincaid_grade DECIMAL(5,2),
  gunning_fog_index DECIMAL(5,2),

  -- 關鍵字分析
  keyword_density DECIMAL(5,2),
  keyword_usage_count INTEGER,

  -- 內部連結（當前文章內的連結）
  internal_links JSONB DEFAULT '[]', -- [{anchor, url, section, articleId}]
  internal_links_count INTEGER DEFAULT 0,

  -- 外部引用
  external_references JSONB DEFAULT '[]', -- [{url, title, domain, type}]
  external_links_count INTEGER DEFAULT 0,

  -- Metadata for semantic search (內部連結推薦用)
  article_metadata JSONB, -- 包含：主題、關鍵概念、內容摘要、相關主題等
  
  -- 用於語義搜索的向量（未來可能使用）
  -- embedding vector(1536), -- OpenAI embedding

  -- WordPress 發布資訊
  wordpress_post_id INTEGER,
  wordpress_post_url TEXT,
  wordpress_status TEXT, -- draft, published, scheduled
  
  -- 圖片資訊
  featured_image_url TEXT,
  featured_image_alt TEXT,
  content_images JSONB DEFAULT '[]', -- [{url, alt, prompt, section}]

  -- 品質分數
  quality_score DECIMAL(5,2),
  quality_passed BOOLEAN DEFAULT false,
  quality_issues JSONB DEFAULT '[]',

  -- AI 模型資訊
  research_model TEXT,
  strategy_model TEXT,
  writing_model TEXT,
  meta_model TEXT,

  -- 執行統計
  generation_time INTEGER, -- 總生成時間（秒）
  token_usage JSONB, -- {research: {input, output}, strategy: {input, output}, writing: {input, output}}
  cost_breakdown JSONB, -- {research, strategy, writing, image, meta, total}

  -- 狀態
  status TEXT DEFAULT 'generated' CHECK (status IN ('generated', 'reviewed', 'published', 'archived')),
  published_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_generated_articles_job ON generated_articles(article_job_id);
CREATE INDEX idx_generated_articles_company ON generated_articles(company_id);
CREATE INDEX idx_generated_articles_website ON generated_articles(website_id);
CREATE INDEX idx_generated_articles_user ON generated_articles(user_id);
CREATE INDEX idx_generated_articles_status ON generated_articles(status);
CREATE INDEX idx_generated_articles_wordpress ON generated_articles(wordpress_post_id) WHERE wordpress_post_id IS NOT NULL;
CREATE INDEX idx_generated_articles_keywords ON generated_articles USING GIN(keywords);
CREATE INDEX idx_generated_articles_categories ON generated_articles USING GIN(categories);
CREATE INDEX idx_generated_articles_tags ON generated_articles USING GIN(tags);
CREATE INDEX idx_generated_articles_metadata ON generated_articles USING GIN(article_metadata);

-- 全文搜索索引（用於標題和內容搜索）
CREATE INDEX idx_generated_articles_title_search ON generated_articles USING GIN(to_tsvector('simple', title));
CREATE INDEX idx_generated_articles_content_search ON generated_articles USING GIN(to_tsvector('simple', markdown_content));

-- 複合索引（用於內部連結推薦）
CREATE INDEX idx_generated_articles_website_keywords ON generated_articles(website_id, keywords);
CREATE INDEX idx_generated_articles_website_categories ON generated_articles(website_id, categories);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_generated_articles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_generated_articles_updated_at
  BEFORE UPDATE ON generated_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_generated_articles_updated_at();

-- ===========================================
-- Article Recommendations (文章推薦關聯表)
-- 用於追蹤內部連結推薦
-- ===========================================

CREATE TABLE article_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_article_id UUID REFERENCES generated_articles(id) ON DELETE CASCADE,
  target_article_id UUID REFERENCES generated_articles(id) ON DELETE CASCADE,
  
  -- 推薦理由
  recommendation_score DECIMAL(5,2), -- 0-100，相似度或相關性分數
  recommendation_reason TEXT, -- 推薦原因：keyword_match, category_match, semantic_similarity, manual
  
  -- 匹配詳情
  matching_keywords TEXT[] DEFAULT '{}',
  matching_categories TEXT[] DEFAULT '{}',
  
  -- 狀態
  status TEXT DEFAULT 'suggested' CHECK (status IN ('suggested', 'accepted', 'rejected', 'implemented')),
  
  -- 實作資訊
  anchor_text TEXT, -- 如果已實作，記錄錨文本
  link_section TEXT, -- 連結所在章節
  implemented_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(source_article_id, target_article_id)
);

CREATE INDEX idx_article_recommendations_source ON article_recommendations(source_article_id);
CREATE INDEX idx_article_recommendations_target ON article_recommendations(target_article_id);
CREATE INDEX idx_article_recommendations_status ON article_recommendations(status);
CREATE INDEX idx_article_recommendations_score ON article_recommendations(recommendation_score DESC);

-- ===========================================
-- 輔助函數：計算文章相關性
-- ===========================================

CREATE OR REPLACE FUNCTION calculate_article_similarity(
  article1_id UUID,
  article2_id UUID
)
RETURNS DECIMAL AS $$
DECLARE
  similarity_score DECIMAL := 0;
  common_keywords INTEGER;
  common_categories INTEGER;
  total_keywords INTEGER;
  total_categories INTEGER;
BEGIN
  -- 計算共同關鍵字數量
  SELECT COUNT(*)
  INTO common_keywords
  FROM (
    SELECT UNNEST(keywords) AS keyword FROM generated_articles WHERE id = article1_id
    INTERSECT
    SELECT UNNEST(keywords) AS keyword FROM generated_articles WHERE id = article2_id
  ) AS common;
  
  -- 計算關鍵字相似度（佔 60%）
  SELECT COUNT(DISTINCT UNNEST(keywords))
  INTO total_keywords
  FROM generated_articles
  WHERE id IN (article1_id, article2_id);
  
  IF total_keywords > 0 THEN
    similarity_score := similarity_score + (common_keywords::DECIMAL / total_keywords * 60);
  END IF;
  
  -- 計算共同分類數量
  SELECT COUNT(*)
  INTO common_categories
  FROM (
    SELECT UNNEST(categories) AS category FROM generated_articles WHERE id = article1_id
    INTERSECT
    SELECT UNNEST(categories) AS category FROM generated_articles WHERE id = article2_id
  ) AS common;
  
  -- 計算分類相似度（佔 40%）
  SELECT COUNT(DISTINCT UNNEST(categories))
  INTO total_categories
  FROM generated_articles
  WHERE id IN (article1_id, article2_id);
  
  IF total_categories > 0 THEN
    similarity_score := similarity_score + (common_categories::DECIMAL / total_categories * 40);
  END IF;
  
  RETURN similarity_score;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 輔助函數：為文章生成推薦連結
-- ===========================================

CREATE OR REPLACE FUNCTION generate_article_recommendations(
  target_article_id UUID,
  max_recommendations INTEGER DEFAULT 5,
  min_score DECIMAL DEFAULT 20.0
)
RETURNS TABLE(
  article_id UUID,
  title TEXT,
  score DECIMAL,
  reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ga.id,
    ga.title,
    calculate_article_similarity(target_article_id, ga.id) AS similarity_score,
    CASE
      WHEN calculate_article_similarity(target_article_id, ga.id) >= 60 THEN 'High keyword and category match'
      WHEN calculate_article_similarity(target_article_id, ga.id) >= 40 THEN 'Moderate keyword match'
      ELSE 'Category match'
    END AS recommendation_reason
  FROM generated_articles ga
  WHERE ga.id != target_article_id
    AND ga.website_id = (SELECT website_id FROM generated_articles WHERE id = target_article_id)
    AND ga.status IN ('published', 'reviewed')
  ORDER BY similarity_score DESC
  LIMIT max_recommendations;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE generated_articles IS '儲存完整的生成文章內容，包含 SEO metadata 和內部連結資訊';
COMMENT ON TABLE article_recommendations IS '文章之間的推薦關聯，用於自動化內部連結建議';
COMMENT ON FUNCTION calculate_article_similarity IS '計算兩篇文章之間的相似度分數（0-100）';
COMMENT ON FUNCTION generate_article_recommendations IS '為指定文章生成內部連結推薦列表';
