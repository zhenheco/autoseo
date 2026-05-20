CREATE TABLE IF NOT EXISTS public.audit_fix_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES public.audit_issues(id) ON DELETE CASCADE,
  applied_by TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  route TEXT NOT NULL CHECK (route IN ('article-generator','shopline-editor','edge-worker','manual')),
  before TEXT,
  after TEXT,
  result TEXT NOT NULL CHECK (result IN ('success','failed')),
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_fix_log_issue ON public.audit_fix_log(issue_id);
ALTER TABLE public.audit_fix_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_fix_log FROM anon, authenticated;
GRANT SELECT ON public.audit_fix_log TO authenticated;
GRANT ALL ON public.audit_fix_log TO service_role;
