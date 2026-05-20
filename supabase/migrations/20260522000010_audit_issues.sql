CREATE TABLE IF NOT EXISTS public.audit_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.audit_reports(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low','medium','high')),
  page TEXT NOT NULL,
  selector TEXT,
  current TEXT NOT NULL,
  suggested TEXT,
  source TEXT NOT NULL CHECK (source IN ('html-scan','cwv','gsc-cross','a11y','security')),
  estimated_impact TEXT NOT NULL CHECK (estimated_impact IN ('high','medium','low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','auto-applied','pending-review','manual','resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_issues_report ON public.audit_issues(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_issues_status ON public.audit_issues(status);
CREATE INDEX IF NOT EXISTS idx_audit_issues_risk ON public.audit_issues(risk_level);

ALTER TABLE public.audit_issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_issues parent visibility" ON public.audit_issues;
CREATE POLICY "audit_issues parent visibility"
  ON public.audit_issues FOR SELECT
  USING (
    report_id IN (
      SELECT id FROM public.audit_reports
    )
  );

REVOKE ALL ON public.audit_issues FROM anon;
REVOKE ALL ON public.audit_issues FROM authenticated;
GRANT SELECT ON public.audit_issues TO authenticated;
GRANT ALL ON public.audit_issues TO service_role;
