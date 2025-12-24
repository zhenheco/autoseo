-- =====================================================
-- Migration: 網站健康檢查功能
-- 建立日期: 2024-12-24
-- 說明: 為用戶的 WordPress 網站提供 SEO 健檢功能
-- =====================================================

-- 網站健康檢查結果表
CREATE TABLE IF NOT EXISTS website_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL,
  company_id UUID NOT NULL,

  -- 狀態管理
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  -- 檢查目標
  url_checked TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'mobile' CHECK (device_type IN ('mobile', 'desktop')),

  -- Core Web Vitals (儲存原始數值)
  lcp_score NUMERIC(8,2),        -- Largest Contentful Paint (毫秒)
  inp_score NUMERIC(8,2),        -- Interaction to Next Paint (毫秒)
  cls_score NUMERIC(8,4),        -- Cumulative Layout Shift
  fcp_score NUMERIC(8,2),        -- First Contentful Paint (毫秒)
  ttfb_score NUMERIC(8,2),       -- Time to First Byte (毫秒)

  -- Lighthouse 綜合分數 (0-100)
  performance_score INTEGER CHECK (performance_score IS NULL OR (performance_score >= 0 AND performance_score <= 100)),
  accessibility_score INTEGER CHECK (accessibility_score IS NULL OR (accessibility_score >= 0 AND accessibility_score <= 100)),
  seo_score INTEGER CHECK (seo_score IS NULL OR (seo_score >= 0 AND seo_score <= 100)),
  best_practices_score INTEGER CHECK (best_practices_score IS NULL OR (best_practices_score >= 0 AND best_practices_score <= 100)),

  -- Meta 標籤分析 (JSONB)
  -- 結構:
  -- {
  --   "title": { "exists": true, "length": 55, "content": "...", "issues": [] },
  --   "description": { "exists": true, "length": 150, "content": "...", "issues": [] },
  --   "og_title": { "exists": true, "content": "..." },
  --   "og_description": { "exists": true, "content": "..." },
  --   "og_image": { "exists": true, "url": "..." },
  --   "canonical": { "exists": true, "url": "..." },
  --   "robots": { "exists": true, "content": "index,follow" }
  -- }
  meta_analysis JSONB DEFAULT '{}',

  -- 結構化資料分析 (JSONB)
  -- 結構:
  -- {
  --   "has_json_ld": true,
  --   "types_found": ["Article", "Organization"],
  --   "issues": [],
  --   "raw_data": [...]
  -- }
  structured_data JSONB DEFAULT '{}',

  -- 基礎 SEO 檢查
  robots_txt_exists BOOLEAN,
  robots_txt_issues TEXT[],
  sitemap_exists BOOLEAN,
  sitemap_url TEXT,
  sitemap_issues TEXT[],

  -- PageSpeed API 原始回應 (用於除錯和詳細分析)
  raw_pagespeed_response JSONB,

  -- AI 生成的改善建議 (JSONB Array)
  -- 結構:
  -- [
  --   {
  --     "priority": "high" | "medium" | "low",
  --     "category": "performance" | "seo" | "accessibility" | "best-practices",
  --     "title": "優化圖片載入",
  --     "description": "...",
  --     "impact": "高" | "中" | "低",
  --     "effort": "高" | "中" | "低"
  --   }
  -- ]
  ai_recommendations JSONB DEFAULT '[]',

  -- 錯誤追蹤
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- 時間戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_health_checks_website ON website_health_checks(website_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_company ON website_health_checks(company_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON website_health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_created ON website_health_checks(created_at DESC);

-- 複合索引：用於查詢特定網站的最新檢查
CREATE INDEX IF NOT EXISTS idx_health_checks_website_created ON website_health_checks(website_id, created_at DESC);

-- 啟用 RLS
ALTER TABLE website_health_checks ENABLE ROW LEVEL SECURITY;

-- RLS 政策：用戶只能查看自己公司的健康檢查
CREATE POLICY "Users can view their company health checks"
ON website_health_checks FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- RLS 政策：用戶可以為自己公司建立健康檢查
CREATE POLICY "Users can insert health checks for their company"
ON website_health_checks FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- RLS 政策：用戶可以更新自己公司的健康檢查
CREATE POLICY "Users can update their company health checks"
ON website_health_checks FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM company_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- Service role 可以存取所有資料（用於 API 路由）
CREATE POLICY "Service role has full access to health checks"
ON website_health_checks FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- 建立 updated_at 自動更新 trigger
CREATE OR REPLACE FUNCTION update_health_checks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_health_checks_updated_at
  BEFORE UPDATE ON website_health_checks
  FOR EACH ROW
  EXECUTE FUNCTION update_health_checks_updated_at();

-- 註解
COMMENT ON TABLE website_health_checks IS '網站健康檢查結果，包含 Core Web Vitals、Lighthouse 分數、Meta 分析和 AI 建議';
COMMENT ON COLUMN website_health_checks.lcp_score IS 'Largest Contentful Paint 毫秒數';
COMMENT ON COLUMN website_health_checks.inp_score IS 'Interaction to Next Paint 毫秒數';
COMMENT ON COLUMN website_health_checks.cls_score IS 'Cumulative Layout Shift 分數';
COMMENT ON COLUMN website_health_checks.fcp_score IS 'First Contentful Paint 毫秒數';
COMMENT ON COLUMN website_health_checks.ttfb_score IS 'Time to First Byte 毫秒數';
COMMENT ON COLUMN website_health_checks.meta_analysis IS 'Meta 標籤分析結果，包含 title、description、OG tags 等';
COMMENT ON COLUMN website_health_checks.ai_recommendations IS 'AI 生成的改善建議陣列';
