CREATE TABLE IF NOT EXISTS public.shopline_gdpr_redact_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_type TEXT NOT NULL CHECK (webhook_type IN ('customer-redact','shop-redact')),
  shop_id TEXT,
  shop_domain TEXT,
  payload_summary TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  result TEXT CHECK (result IN ('queued','processed','failed')),
  error_message TEXT
);

ALTER TABLE public.shopline_gdpr_redact_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopline_gdpr_redact_log FROM anon, authenticated;
GRANT ALL ON public.shopline_gdpr_redact_log TO service_role;

COMMENT ON TABLE public.shopline_gdpr_redact_log IS 'SHOPLINE GDPR-required webhook receipt log. No PII; only operational summary.';
