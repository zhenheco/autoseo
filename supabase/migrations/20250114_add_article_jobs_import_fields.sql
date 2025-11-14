-- Migration: Add Excel import fields to article_jobs
-- Date: 2025-01-14
-- Description: Add article_type, scheduled_publish_at, published_url, slug, and slug_strategy fields

ALTER TABLE article_jobs
ADD COLUMN IF NOT EXISTS article_type TEXT CHECK (
  article_type IN ('教學', '排行榜', '比較', '資訊型')
),
ADD COLUMN IF NOT EXISTS scheduled_publish_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_url TEXT,
ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS slug_strategy TEXT DEFAULT 'auto' CHECK (
  slug_strategy IN ('auto', 'pinyin', 'english', 'custom')
);

-- Add unique constraint for website_id + slug
ALTER TABLE article_jobs
ADD CONSTRAINT unique_website_slug UNIQUE (website_id, slug);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_article_jobs_website_slug
ON article_jobs(website_id, slug);

CREATE INDEX IF NOT EXISTS idx_published_articles
ON article_jobs(website_id, slug)
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs
ON article_jobs(scheduled_publish_at)
WHERE status = 'pending';

-- Add website_configs fields
ALTER TABLE website_configs
ADD COLUMN IF NOT EXISTS base_url TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS slug_prefix TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS url_strategy TEXT DEFAULT 'relative' CHECK (
  url_strategy IN ('relative', 'absolute')
),
ADD COLUMN IF NOT EXISTS default_slug_strategy TEXT DEFAULT 'auto' CHECK (
  default_slug_strategy IN ('auto', 'pinyin', 'english', 'custom')
);
