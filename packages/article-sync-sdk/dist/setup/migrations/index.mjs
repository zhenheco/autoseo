// src/setup/migrations/index.ts
var SYNCED_ARTICLES_MIGRATION = `
-- =============================================
-- Migration: synced_articles
-- \u540C\u6B65\u6587\u7AE0\u8868\uFF08\u4F9B\u5916\u90E8\u5C08\u6848\u4F7F\u7528\uFF09
-- \u4F86\u81EA @1wayseo/article-sync-sdk
-- =============================================

-- \u5275\u5EFA synced_articles \u8868
CREATE TABLE IF NOT EXISTS synced_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- \u4F86\u6E90\u8B58\u5225
  source_id TEXT NOT NULL UNIQUE,        -- 1waySEO \u7684 article ID
  slug TEXT NOT NULL,

  -- \u5167\u5BB9
  title TEXT NOT NULL,
  excerpt TEXT,
  html_content TEXT,
  markdown_content TEXT,

  -- \u5206\u985E\u548C\u6A19\u7C64
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- \u591A\u8A9E\u7CFB
  language TEXT NOT NULL DEFAULT 'zh-TW',

  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  focus_keyword TEXT,
  keywords TEXT[] DEFAULT '{}',

  -- \u5A92\u9AD4
  featured_image_url TEXT,
  featured_image_alt TEXT,

  -- \u95B1\u8B80\u8CC7\u8A0A
  word_count INTEGER,
  reading_time INTEGER,

  -- \u6642\u9593\u6233\u8A18
  published_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- \u540C\u6B65\u72C0\u614B
  sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'deleted'))
);

-- \u5275\u5EFA\u7D22\u5F15
CREATE INDEX IF NOT EXISTS idx_synced_articles_slug ON synced_articles(slug);
CREATE INDEX IF NOT EXISTS idx_synced_articles_source_id ON synced_articles(source_id);
CREATE INDEX IF NOT EXISTS idx_synced_articles_language ON synced_articles(language);
CREATE INDEX IF NOT EXISTS idx_synced_articles_status ON synced_articles(sync_status);
CREATE INDEX IF NOT EXISTS idx_synced_articles_published_at ON synced_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_synced_articles_categories ON synced_articles USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_synced_articles_tags ON synced_articles USING GIN(tags);

-- \u5275\u5EFA updated_at \u89F8\u767C\u5668
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

-- RLS \u653F\u7B56\uFF08\u53EF\u9078\uFF1A\u6839\u64DA\u9700\u6C42\u8ABF\u6574\uFF09
ALTER TABLE synced_articles ENABLE ROW LEVEL SECURITY;

-- \u516C\u958B\u8B80\u53D6\uFF1A\u6240\u6709\u4EBA\u53EF\u4EE5\u67E5\u770B\u5DF2\u767C\u5E03\u7684\u6587\u7AE0
CREATE POLICY "Public can read active articles" ON synced_articles
  FOR SELECT
  USING (sync_status = 'active');

-- \u6DFB\u52A0\u8A3B\u89E3
COMMENT ON TABLE synced_articles IS '\u540C\u6B65\u81EA 1waySEO \u7684\u6587\u7AE0';
COMMENT ON COLUMN synced_articles.source_id IS '1waySEO \u7684\u6587\u7AE0 ID';
COMMENT ON COLUMN synced_articles.sync_status IS '\u540C\u6B65\u72C0\u614B\uFF1Aactive\uFF08\u6709\u6548\uFF09\u3001deleted\uFF08\u5DF2\u522A\u9664\uFF09';
`;
function getMigrationSQL() {
  return SYNCED_ARTICLES_MIGRATION;
}
export {
  SYNCED_ARTICLES_MIGRATION,
  getMigrationSQL
};
//# sourceMappingURL=index.mjs.map