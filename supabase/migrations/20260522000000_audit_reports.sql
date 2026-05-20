CREATE TABLE IF NOT EXISTS public.audit_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  website_id UUID REFERENCES public.website_configs(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('single-page','sitemap','crawl')),
  health_score INTEGER NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  pages_scanned INTEGER NOT NULL DEFAULT 1,
  raw_payload JSONB NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('cli','dashboard','cron','lead-gen')),
  scanned_at TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_company ON public.audit_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_website ON public.audit_reports(website_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_url_scanned ON public.audit_reports(url, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_lead ON public.audit_reports(source) WHERE source = 'lead-gen';

ALTER TABLE public.audit_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_reports company member select" ON public.audit_reports;
CREATE POLICY "audit_reports company member select"
  ON public.audit_reports FOR SELECT
  USING (
    company_id IS NULL OR company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

REVOKE ALL ON public.audit_reports FROM anon;
REVOKE ALL ON public.audit_reports FROM authenticated;
GRANT SELECT ON public.audit_reports TO authenticated;
GRANT ALL ON public.audit_reports TO service_role;

COMMENT ON TABLE public.audit_reports IS 'SEO audit scan results. company_id NULL for public lead-gen scans.';
