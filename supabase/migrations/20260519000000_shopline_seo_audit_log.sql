-- ===========================================
-- SHOPLINE SEO audit log
-- ===========================================

CREATE TABLE public.shopline_seo_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.website_configs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product','collection','shop','image','category_assignment','redirect','collection_hierarchy')),
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT,
  source TEXT NOT NULL CHECK (source IN ('ui','cli','ai')),
  model TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shopline_seo_audit_log_company_website_idx
  ON public.shopline_seo_audit_log(company_id, website_id, created_at DESC);

CREATE INDEX shopline_seo_audit_log_entity_idx
  ON public.shopline_seo_audit_log(entity_type, entity_id);

ALTER TABLE public.shopline_seo_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopline_seo_audit_log_company_select
  ON public.shopline_seo_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_members
      WHERE company_members.company_id = shopline_seo_audit_log.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.status = 'active'
    )
  );

CREATE POLICY shopline_seo_audit_log_company_insert
  ON public.shopline_seo_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_members
      WHERE company_members.company_id = shopline_seo_audit_log.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.status = 'active'
    )
  );

CREATE POLICY shopline_seo_audit_log_admin_select
  ON public.shopline_seo_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

REVOKE ALL ON public.shopline_seo_audit_log FROM anon;
GRANT SELECT, INSERT ON public.shopline_seo_audit_log TO authenticated;
GRANT ALL ON public.shopline_seo_audit_log TO service_role;

COMMENT ON TABLE public.shopline_seo_audit_log IS 'Granular per-field SHOPLINE SEO write audit log.';
