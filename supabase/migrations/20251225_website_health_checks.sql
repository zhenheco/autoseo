-- Website Health Check Tables
-- 網站健康檢查功能的資料庫表格
-- 建立時間: 2025-12-25

-- 結果存儲表（詳細數據）- 先建立因為 jobs 表會參照它
CREATE TABLE IF NOT EXISTS website_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  url_checked TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'mobile',

  -- Core Web Vitals
  lcp_ms NUMERIC(8,2),        -- Largest Contentful Paint
  inp_ms NUMERIC(8,2),        -- Interaction to Next Paint
  cls NUMERIC(6,4),           -- Cumulative Layout Shift
  fcp_ms NUMERIC(8,2),        -- First Contentful Paint
  ttfb_ms NUMERIC(8,2),       -- Time to First Byte

  -- 綜合分數 (0-100)
  performance_score INTEGER,
  accessibility_score INTEGER,
  seo_score INTEGER,
  best_practices_score INTEGER,

  -- 詳細分析 (JSONB)
  meta_analysis JSONB DEFAULT '{}',
  ai_recommendations JSONB DEFAULT '[]',

  -- 基礎 SEO
  robots_txt_exists BOOLEAN,
  sitemap_exists BOOLEAN,
  sitemap_url TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job 隊列表（輕量，用於追蹤狀態）
CREATE TABLE IF NOT EXISTS website_health_check_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES website_configs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  url_to_check TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'mobile',
  include_ai_recommendations BOOLEAN DEFAULT true,

  -- 處理追蹤
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,

  -- 關聯結果
  result_id UUID REFERENCES website_health_checks(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index 優化查詢
CREATE INDEX IF NOT EXISTS idx_health_check_jobs_status
  ON website_health_check_jobs(status);
CREATE INDEX IF NOT EXISTS idx_health_check_jobs_website
  ON website_health_check_jobs(website_id);
CREATE INDEX IF NOT EXISTS idx_health_check_jobs_pending
  ON website_health_check_jobs(status, started_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_health_checks_website
  ON website_health_checks(website_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_created
  ON website_health_checks(website_id, created_at DESC);

-- RLS 政策
ALTER TABLE website_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_health_check_jobs ENABLE ROW LEVEL SECURITY;

-- 健康檢查結果的 RLS 政策
CREATE POLICY "Users can view their company's health checks"
  ON website_health_checks FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert health checks for their company"
  ON website_health_checks FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- 健康檢查 Jobs 的 RLS 政策
CREATE POLICY "Users can view their company's health check jobs"
  ON website_health_check_jobs FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert health check jobs for their company"
  ON website_health_check_jobs FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their company's health check jobs"
  ON website_health_check_jobs FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM company_members WHERE user_id = auth.uid()
  ));

-- Service Role 可以完全存取（用於 GitHub Actions）
CREATE POLICY "Service role can manage all health checks"
  ON website_health_checks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage all health check jobs"
  ON website_health_check_jobs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 註解
COMMENT ON TABLE website_health_checks IS '網站健康檢查結果存儲';
COMMENT ON TABLE website_health_check_jobs IS '網站健康檢查任務隊列';
COMMENT ON COLUMN website_health_check_jobs.status IS 'pending=等待處理, processing=處理中, completed=完成, failed=失敗';
