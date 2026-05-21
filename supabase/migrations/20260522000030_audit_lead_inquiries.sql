CREATE TABLE IF NOT EXISTS public.audit_lead_inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  url TEXT NOT NULL,
  email TEXT,
  ip_hash TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted_to_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  nurture_stage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_url ON public.audit_lead_inquiries(url);
CREATE INDEX IF NOT EXISTS idx_lead_ip ON public.audit_lead_inquiries(ip_hash, scanned_at DESC);
ALTER TABLE public.audit_lead_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_lead_inquiries FROM anon, authenticated;
GRANT ALL ON public.audit_lead_inquiries TO service_role;
