-- Store Amego retry state and the signed microservice payload so webhook and
-- reconciliation runs replay the same idempotent invoice request.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amego_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amego_last_error TEXT,
  ADD COLUMN IF NOT EXISTS amego_payload JSONB;
