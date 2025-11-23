-- Add content_json column to generated_articles table for TipTap editor
-- This migration supports Phase 3 of the UX enhancement: WYSIWYG editor

-- Add content_json column (JSONB type for structured content)
ALTER TABLE generated_articles
ADD COLUMN IF NOT EXISTS content_json JSONB;

-- Add index for better query performance on content_json
CREATE INDEX IF NOT EXISTS idx_generated_articles_content_json
ON generated_articles USING GIN (content_json);

-- Add comment to explain the column
COMMENT ON COLUMN generated_articles.content_json IS 'TipTap editor JSON content (ProseMirror document)';

-- Note: We keep html_content for backward compatibility and as a fallback
-- The application will:
-- 1. Save both content_json (TipTap) and html_content (rendered HTML)
-- 2. Prefer content_json when available
-- 3. Fall back to html_content for legacy articles
