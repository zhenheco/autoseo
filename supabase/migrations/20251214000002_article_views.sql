-- Migration: Article Views
-- Description: 建立文章閱讀統計表
-- Date: 2025-12-14

-- ============================================
-- 1. 建立 article_views 表（聚合統計）
-- ============================================

CREATE TABLE IF NOT EXISTS public.article_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES generated_articles(id) ON DELETE CASCADE,

  -- 閱讀統計
  total_views INTEGER DEFAULT 0,
  unique_views INTEGER DEFAULT 0,

  -- 時間區段統計（可用於熱門排行）
  views_today INTEGER DEFAULT 0,
  views_this_week INTEGER DEFAULT 0,
  views_this_month INTEGER DEFAULT 0,

  -- 時間戳
  last_viewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 確保每篇文章只有一筆統計記錄
  CONSTRAINT article_views_article_unique UNIQUE (article_id)
);

-- 加上註解
COMMENT ON TABLE article_views IS '文章閱讀統計表，用於追蹤閱讀次數和熱門文章排行';

-- ============================================
-- 2. 建立索引
-- ============================================

-- 依文章 ID 查詢
CREATE INDEX IF NOT EXISTS idx_article_views_article
ON article_views(article_id);

-- 依總閱讀數排序（熱門文章）
CREATE INDEX IF NOT EXISTS idx_article_views_total_desc
ON article_views(total_views DESC);

-- 依週閱讀數排序（近期熱門）
CREATE INDEX IF NOT EXISTS idx_article_views_week_desc
ON article_views(views_this_week DESC);

-- ============================================
-- 3. 啟用 RLS 並設定政策
-- ============================================

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

-- 3.1 公開可讀取統計資料
DROP POLICY IF EXISTS "Public can view article stats" ON article_views;
CREATE POLICY "Public can view article stats"
ON public.article_views FOR SELECT
USING (true);

-- 3.2 只有 service_role 可以更新統計（透過 API 更新）
DROP POLICY IF EXISTS "Service role can manage article views" ON article_views;
CREATE POLICY "Service role can manage article views"
ON public.article_views FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 4. 建立自動更新 updated_at 的 trigger
-- ============================================

-- 先檢查是否已存在 trigger function
CREATE OR REPLACE FUNCTION update_article_views_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS article_views_updated_at ON article_views;
CREATE TRIGGER article_views_updated_at
BEFORE UPDATE ON article_views
FOR EACH ROW
EXECUTE FUNCTION update_article_views_updated_at();

-- ============================================
-- 5. 建立重置每日/週/月統計的函數（可選，供 cron job 使用）
-- ============================================

CREATE OR REPLACE FUNCTION reset_article_views_daily()
RETURNS void AS $$
BEGIN
  UPDATE article_views SET views_today = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_article_views_weekly()
RETURNS void AS $$
BEGIN
  UPDATE article_views SET views_this_week = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reset_article_views_monthly()
RETURNS void AS $$
BEGIN
  UPDATE article_views SET views_this_month = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
