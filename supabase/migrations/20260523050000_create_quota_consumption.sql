-- Unified quota consumption ledger.
--
-- Monthly resources use the first day of the current UTC calendar month as
-- month_bucket. Absolute resources are not reset monthly and use the sentinel
-- bucket 1970-01-01 so they can live in the same table.
--
-- Note: websites are capped per brand. The application reads website usage
-- from website_configs scoped by brand_id; the SECURITY DEFINER function below
-- also validates website quota per brand without writing an aggregate company
-- total into quota_consumption.

CREATE TABLE IF NOT EXISTS public.quota_consumption (
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  resource TEXT NOT NULL CHECK (
    resource IN (
      'articles',
      'cards',
      'social_posts',
      'brands',
      'websites',
      'audits'
    )
  ),
  month_bucket DATE NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (company_id, resource, month_bucket)
);

CREATE INDEX IF NOT EXISTS idx_quota_lookup
  ON public.quota_consumption(company_id, resource);

COMMENT ON TABLE public.quota_consumption IS
  'Quota ledger. Monthly resources use UTC first-of-month buckets; absolute resources use 1970-01-01 sentinel. Websites are enforced per brand via website_configs.';
COMMENT ON COLUMN public.quota_consumption.month_bucket IS
  'First day of the UTC month for monthly resources. Absolute resources use 1970-01-01.';

ALTER TABLE public.quota_consumption ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.quota_user_has_company_access(check_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.company_members
    WHERE company_members.company_id = check_company_id
      AND company_members.user_id = auth.uid()
      AND COALESCE(company_members.status, 'active') = 'active'
  );
$$;

DROP POLICY IF EXISTS quota_consumption_select ON public.quota_consumption;
CREATE POLICY quota_consumption_select
  ON public.quota_consumption FOR SELECT TO authenticated
  USING (public.quota_user_has_company_access(company_id));

DROP POLICY IF EXISTS quota_consumption_insert ON public.quota_consumption;
CREATE POLICY quota_consumption_insert
  ON public.quota_consumption FOR INSERT TO service_role
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS quota_consumption_update ON public.quota_consumption;
CREATE POLICY quota_consumption_update
  ON public.quota_consumption FOR UPDATE TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS quota_consumption_delete ON public.quota_consumption;
CREATE POLICY quota_consumption_delete
  ON public.quota_consumption FOR DELETE TO service_role
  USING (TRUE);

REVOKE ALL ON public.quota_consumption FROM anon;
GRANT SELECT ON public.quota_consumption TO authenticated;
GRANT ALL ON public.quota_consumption TO service_role;

CREATE OR REPLACE FUNCTION public.quota_consume_atomic(
  p_company_id UUID,
  p_resource TEXT,
  p_amount INTEGER,
  p_cap INTEGER,
  p_brand_id UUID DEFAULT NULL
)
RETURNS TABLE(allowed BOOLEAN, used INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket DATE;
  v_used INTEGER;
BEGIN
  IF p_resource NOT IN (
    'articles',
    'cards',
    'social_posts',
    'brands',
    'websites',
    'audits'
  ) THEN
    RAISE EXCEPTION 'unsupported quota resource: %', p_resource;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'quota amount must be a positive integer';
  END IF;

  IF p_cap IS NULL OR p_cap < 0 THEN
    RAISE EXCEPTION 'quota cap must be zero or greater';
  END IF;

  IF p_resource = 'websites' THEN
    IF p_brand_id IS NULL THEN
      RAISE EXCEPTION 'brand_id is required for website quota';
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(p_company_id::TEXT || ':websites:' || p_brand_id::TEXT, 0)
    );

    SELECT COUNT(*)::INTEGER
    INTO v_used
    FROM public.website_configs
    WHERE website_configs.company_id = p_company_id
      AND website_configs.brand_id = p_brand_id;

    RETURN QUERY
    SELECT (v_used + p_amount) <= p_cap, v_used;
    RETURN;
  END IF;

  v_bucket := CASE
    WHEN p_resource IN ('brands', 'websites') THEN '1970-01-01'::DATE
    ELSE date_trunc('month', NOW() AT TIME ZONE 'UTC')::DATE
  END;

  WITH attempted AS (
    INSERT INTO public.quota_consumption (
      company_id,
      resource,
      month_bucket,
      used
    )
    SELECT p_company_id, p_resource, v_bucket, p_amount
    WHERE p_amount <= p_cap
    ON CONFLICT (company_id, resource, month_bucket)
    DO UPDATE SET used = quota_consumption.used + EXCLUDED.used
    WHERE quota_consumption.used + EXCLUDED.used <= p_cap
    RETURNING quota_consumption.used
  )
  SELECT attempted.used
  INTO v_used
  FROM attempted;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, v_used;
    RETURN;
  END IF;

  SELECT quota_consumption.used
  INTO v_used
  FROM public.quota_consumption
  WHERE quota_consumption.company_id = p_company_id
    AND quota_consumption.resource = p_resource
    AND quota_consumption.month_bucket = v_bucket;

  RETURN QUERY SELECT FALSE, COALESCE(v_used, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.quota_consume_atomic(UUID, TEXT, INTEGER, INTEGER, UUID)
  TO service_role;
