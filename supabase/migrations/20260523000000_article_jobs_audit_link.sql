ALTER TABLE public.article_jobs
  ADD COLUMN IF NOT EXISTS audit_issue_id UUID REFERENCES public.audit_issues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_article_jobs_audit_issue
  ON public.article_jobs(audit_issue_id)
  WHERE audit_issue_id IS NOT NULL;

COMMENT ON COLUMN public.article_jobs.audit_issue_id IS 'FK to audit_issues - set when job was auto-created from audit-driven content gap detection.';
COMMENT ON COLUMN public.article_jobs.source_type IS 'audit-driven / manual / scheduled etc.';
