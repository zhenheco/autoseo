-- Add soft delete support to brands and keep RLS reads scoped to active rows.

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_brands_company_not_deleted
  ON public.brands(company_id)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS brand_layer_brands_select ON public.brands;
CREATE POLICY brand_layer_brands_select
  ON public.brands FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.brand_layer_user_has_company_access(company_id)
  );

DROP POLICY IF EXISTS brand_layer_brands_insert ON public.brands;
CREATE POLICY brand_layer_brands_insert
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND public.brand_layer_user_has_company_access(company_id)
  );

DROP POLICY IF EXISTS brand_layer_brands_update ON public.brands;
CREATE POLICY brand_layer_brands_update
  ON public.brands FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.brand_layer_user_has_company_access(company_id)
  )
  WITH CHECK (public.brand_layer_user_has_company_access(company_id));

DROP POLICY IF EXISTS brand_layer_brands_delete ON public.brands;
CREATE POLICY brand_layer_brands_delete
  ON public.brands FOR DELETE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.brand_layer_user_has_company_access(company_id)
  );

DROP POLICY IF EXISTS brand_layer_brand_keywords_select ON public.brand_keywords;
CREATE POLICY brand_layer_brand_keywords_select
  ON public.brand_keywords FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_keywords_insert ON public.brand_keywords;
CREATE POLICY brand_layer_brand_keywords_insert
  ON public.brand_keywords FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_keywords_update ON public.brand_keywords;
CREATE POLICY brand_layer_brand_keywords_update
  ON public.brand_keywords FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_keywords_delete ON public.brand_keywords;
CREATE POLICY brand_layer_brand_keywords_delete
  ON public.brand_keywords FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_performance_memory_select ON public.brand_performance_memory;
CREATE POLICY brand_layer_brand_performance_memory_select
  ON public.brand_performance_memory FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_performance_memory.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_performance_memory_insert ON public.brand_performance_memory;
CREATE POLICY brand_layer_brand_performance_memory_insert
  ON public.brand_performance_memory FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_performance_memory.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_performance_memory_update ON public.brand_performance_memory;
CREATE POLICY brand_layer_brand_performance_memory_update
  ON public.brand_performance_memory FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_performance_memory.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_performance_memory.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS brand_layer_brand_performance_memory_delete ON public.brand_performance_memory;
CREATE POLICY brand_layer_brand_performance_memory_delete
  ON public.brand_performance_memory FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_performance_memory.brand_id
        AND brands.deleted_at IS NULL
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );
