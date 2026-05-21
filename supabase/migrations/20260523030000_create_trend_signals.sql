CREATE TABLE IF NOT EXISTS public.trend_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  topic TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('perplexity','gsc','google_trends','manual')),
  confidence DECIMAL(3,2) NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  signal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_trend_signal_per_day
  ON public.trend_signals(brand_id, topic, source, signal_date);

-- Do not include NOW() in the partial predicate: PostgreSQL requires index
-- predicates to be immutable. Keep expires_at in the indexed columns so queries
-- for currently usable signals can still filter it efficiently.
CREATE INDEX IF NOT EXISTS idx_trend_signals_brand_unused
  ON public.trend_signals(brand_id, confidence DESC, expires_at)
  WHERE used_at IS NULL;

ALTER TABLE public.trend_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trend_signals_select ON public.trend_signals;
CREATE POLICY trend_signals_select
  ON public.trend_signals FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = trend_signals.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS trend_signals_insert ON public.trend_signals;
CREATE POLICY trend_signals_insert
  ON public.trend_signals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = trend_signals.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS trend_signals_update ON public.trend_signals;
CREATE POLICY trend_signals_update
  ON public.trend_signals FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = trend_signals.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = trend_signals.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS trend_signals_delete ON public.trend_signals;
CREATE POLICY trend_signals_delete
  ON public.trend_signals FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = trend_signals.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

REVOKE ALL ON public.trend_signals FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trend_signals TO authenticated;
GRANT ALL ON public.trend_signals TO service_role;
