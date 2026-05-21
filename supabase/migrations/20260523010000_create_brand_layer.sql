-- Brand layer schema and legacy website brand_voice backfill.
-- This migration is intentionally defensive: it preserves all existing rows,
-- backfills foreign keys before dropping website_configs.brand_voice, and
-- can be re-run on a partially migrated database.

CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  voice_tone TEXT,
  target_audience JSONB,
  value_props TEXT[],
  brand_guidelines TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_company ON public.brands(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_brand_default_per_company
  ON public.brands(company_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS public.brand_keywords (
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  keyword TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brand_id, keyword)
);

CREATE TABLE IF NOT EXISTS public.brand_performance_memory (
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (brand_id, metric_key)
);

CREATE OR REPLACE FUNCTION public.brand_layer_user_has_company_access(check_company_id UUID)
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
      AND company_members.status = 'active'
  );
$$;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_performance_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_layer_brands_select ON public.brands;
CREATE POLICY brand_layer_brands_select
  ON public.brands FOR SELECT TO authenticated
  USING (public.brand_layer_user_has_company_access(company_id));

DROP POLICY IF EXISTS brand_layer_brands_insert ON public.brands;
CREATE POLICY brand_layer_brands_insert
  ON public.brands FOR INSERT TO authenticated
  WITH CHECK (public.brand_layer_user_has_company_access(company_id));

DROP POLICY IF EXISTS brand_layer_brands_update ON public.brands;
CREATE POLICY brand_layer_brands_update
  ON public.brands FOR UPDATE TO authenticated
  USING (public.brand_layer_user_has_company_access(company_id))
  WITH CHECK (public.brand_layer_user_has_company_access(company_id));

DROP POLICY IF EXISTS brand_layer_brands_delete ON public.brands;
CREATE POLICY brand_layer_brands_delete
  ON public.brands FOR DELETE TO authenticated
  USING (public.brand_layer_user_has_company_access(company_id));

DROP POLICY IF EXISTS brand_layer_brand_keywords_select ON public.brand_keywords;
CREATE POLICY brand_layer_brand_keywords_select
  ON public.brand_keywords FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
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
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_keywords.brand_id
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
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = brand_performance_memory.brand_id
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
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

REVOKE ALL ON public.brands FROM anon;
REVOKE ALL ON public.brand_keywords FROM anon;
REVOKE ALL ON public.brand_performance_memory FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_keywords TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_performance_memory TO authenticated;
GRANT ALL ON public.brands TO service_role;
GRANT ALL ON public.brand_keywords TO service_role;
GRANT ALL ON public.brand_performance_memory TO service_role;

-- For each company without any brand, create one default brand named after the company.
INSERT INTO public.brands (company_id, name, is_default)
SELECT companies.id, companies.name, TRUE
FROM public.companies
WHERE NOT EXISTS (
  SELECT 1
  FROM public.brands
  WHERE brands.company_id = companies.id
);

DO $$
DECLARE
  company_count INTEGER;
  default_brand_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO company_count FROM public.companies;
  SELECT COUNT(*) INTO default_brand_count FROM public.brands WHERE is_default = TRUE;

  IF EXISTS (
    SELECT 1
    FROM public.companies
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.company_id = companies.id
        AND brands.is_default = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'Brand backfill failed: at least one company has no default brand';
  END IF;

  RAISE NOTICE 'Brand backfill verified: % companies, % default brands', company_count, default_brand_count;
END $$;

ALTER TABLE public.website_configs
  ADD COLUMN IF NOT EXISTS brand_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'website_configs'
      AND constraint_name = 'website_configs_brand_id_fkey'
  ) THEN
    ALTER TABLE public.website_configs
      ADD CONSTRAINT website_configs_brand_id_fkey
      FOREIGN KEY (brand_id)
      REFERENCES public.brands(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_website_configs_brand
  ON public.website_configs(brand_id);

CREATE TEMP TABLE IF NOT EXISTS brand_layer_backfill_counts (
  table_name TEXT PRIMARY KEY,
  row_count INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO brand_layer_backfill_counts (table_name, row_count)
VALUES ('website_configs_before', (SELECT COUNT(*) FROM public.website_configs))
ON CONFLICT (table_name)
DO UPDATE SET row_count = EXCLUDED.row_count;

UPDATE public.website_configs
SET brand_id = brands.id
FROM public.brands
WHERE brands.company_id = website_configs.company_id
  AND brands.is_default = TRUE
  AND website_configs.brand_id IS NULL
  AND website_configs.is_platform_blog IS NOT TRUE
  AND website_configs.company_id IS NOT NULL;

DO $$
DECLARE
  row_count_before INTEGER;
  row_count_after INTEGER;
  missing_brand_count INTEGER;
  platform_brand_count INTEGER;
BEGIN
  SELECT row_count INTO row_count_before
  FROM brand_layer_backfill_counts
  WHERE table_name = 'website_configs_before';

  SELECT COUNT(*) INTO row_count_after FROM public.website_configs;

  IF row_count_before <> row_count_after THEN
    RAISE EXCEPTION 'website_configs row count changed during brand backfill: before %, after %',
      row_count_before, row_count_after;
  END IF;

  SELECT COUNT(*) INTO missing_brand_count
  FROM public.website_configs
  WHERE is_platform_blog IS NOT TRUE
    AND brand_id IS NULL;

  IF missing_brand_count > 0 THEN
    RAISE EXCEPTION 'website_configs brand backfill incomplete: % non-platform rows still have NULL brand_id',
      missing_brand_count;
  END IF;

  SELECT COUNT(*) INTO platform_brand_count
  FROM public.website_configs
  WHERE is_platform_blog IS TRUE
    AND brand_id IS NOT NULL;

  IF platform_brand_count > 0 THEN
    RAISE EXCEPTION 'website_configs brand backfill violated Platform Blog invariant: % platform rows have brand_id',
      platform_brand_count;
  END IF;

  RAISE NOTICE 'website_configs brand backfill verified: % rows preserved, % missing non-platform brand_id',
    row_count_after, missing_brand_count;
END $$;

-- website_type is a TEXT column with a CHECK constraint in this schema.
DO $$
DECLARE
  check_constraint RECORD;
BEGIN
  FOR check_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.website_configs'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%website_type%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.website_configs DROP CONSTRAINT IF EXISTS %I',
      check_constraint.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.website_configs
  ADD CONSTRAINT website_configs_website_type_check
  CHECK (website_type IN ('wordpress', 'platform_blog', 'external', 'shopline'));

-- Per-website best-effort legacy lift. If multiple websites under the same
-- default brand disagree, the alphabetically first website_name wins and the
-- variants are logged with NOTICE. Existing brand fields are never overwritten.
DO $$
DECLARE
  conflict RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'website_configs'
      AND column_name = 'brand_voice'
  ) THEN
    FOR conflict IN EXECUTE $SQL$
      WITH brand_voice_rows AS (
        SELECT
          brands.id AS brand_id,
          brands.company_id,
          website_configs.brand_voice
        FROM public.website_configs
        JOIN public.brands
          ON brands.id = website_configs.brand_id
        WHERE website_configs.brand_voice IS NOT NULL
          AND website_configs.brand_voice <> '{}'::jsonb
          AND website_configs.brand_voice <> 'null'::jsonb
      )
      SELECT
        brand_id,
        company_id,
        COUNT(DISTINCT brand_voice::text) AS variant_count
      FROM brand_voice_rows
      GROUP BY brand_id, company_id
      HAVING COUNT(DISTINCT brand_voice::text) > 1
    $SQL$ LOOP
      RAISE NOTICE 'Conflicting website_configs.brand_voice for brand %, company %: % variants. Using first website alphabetically.',
        conflict.brand_id, conflict.company_id, conflict.variant_count;
    END LOOP;

    EXECUTE $SQL$
      WITH brand_voice_rows AS (
        SELECT
          brands.id AS brand_id,
          website_configs.website_name,
          website_configs.id AS website_id,
          NULLIF(
            COALESCE(
              website_configs.brand_voice->>'voice_tone',
              website_configs.brand_voice->>'tone_of_voice',
              website_configs.brand_voice->>'tone'
            ),
            ''
          ) AS voice_tone,
          CASE
            WHEN jsonb_typeof(website_configs.brand_voice->'audience') IS NOT NULL
              THEN website_configs.brand_voice->'audience'
            WHEN jsonb_typeof(website_configs.brand_voice->'target_audience') IS NOT NULL
              THEN website_configs.brand_voice->'target_audience'
            ELSE NULL
          END AS target_audience,
          CASE
            WHEN jsonb_typeof(website_configs.brand_voice->'value_props') = 'array'
              THEN ARRAY(
                SELECT jsonb_array_elements_text(website_configs.brand_voice->'value_props')
              )
            WHEN jsonb_typeof(website_configs.brand_voice->'value_props') = 'string'
              THEN ARRAY[website_configs.brand_voice->>'value_props']
            ELSE NULL
          END AS value_props,
          NULLIF(
            CONCAT_WS(
              E'\n',
              website_configs.brand_voice->>'brand_guidelines',
              website_configs.brand_voice->>'guidelines',
              website_configs.brand_voice->>'vocabulary',
              website_configs.brand_voice->>'sentence_style',
              website_configs.brand_voice->>'interactivity',
              website_configs.brand_voice->>'writing_style'
            ),
            ''
          ) AS brand_guidelines,
          ROW_NUMBER() OVER (
            PARTITION BY brands.id
            ORDER BY LOWER(website_configs.website_name), website_configs.id
          ) AS row_rank
        FROM public.website_configs
        JOIN public.brands
          ON brands.id = website_configs.brand_id
        WHERE website_configs.brand_voice IS NOT NULL
          AND website_configs.brand_voice <> '{}'::jsonb
          AND website_configs.brand_voice <> 'null'::jsonb
      ),
      chosen AS (
        SELECT *
        FROM brand_voice_rows
        WHERE row_rank = 1
      )
      UPDATE public.brands
      SET
        voice_tone = CASE
          WHEN brands.voice_tone IS NULL AND chosen.voice_tone IS NOT NULL
            THEN chosen.voice_tone
          ELSE brands.voice_tone
        END,
        target_audience = CASE
          WHEN brands.target_audience IS NULL AND chosen.target_audience IS NOT NULL
            THEN chosen.target_audience
          ELSE brands.target_audience
        END,
        value_props = CASE
          WHEN brands.value_props IS NULL AND chosen.value_props IS NOT NULL
            THEN chosen.value_props
          ELSE brands.value_props
        END,
        brand_guidelines = CASE
          WHEN brands.brand_guidelines IS NULL AND chosen.brand_guidelines IS NOT NULL
            THEN chosen.brand_guidelines
          ELSE brands.brand_guidelines
        END
      FROM chosen
      WHERE brands.id = chosen.brand_id
        AND (
          brands.voice_tone IS NULL
          OR brands.target_audience IS NULL
          OR brands.value_props IS NULL
          OR brands.brand_guidelines IS NULL
        )
    $SQL$;

    RAISE NOTICE 'website_configs.brand_voice best-effort lift completed';
  ELSE
    RAISE NOTICE 'website_configs.brand_voice already absent; skipping best-effort lift';
  END IF;
END $$;

ALTER TABLE public.website_configs
  DROP COLUMN IF EXISTS brand_voice;

ALTER TABLE public.generated_articles
  ADD COLUMN IF NOT EXISTS brand_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'generated_articles'
      AND constraint_name = 'generated_articles_brand_id_fkey'
  ) THEN
    ALTER TABLE public.generated_articles
      ADD CONSTRAINT generated_articles_brand_id_fkey
      FOREIGN KEY (brand_id)
      REFERENCES public.brands(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_generated_articles_brand
  ON public.generated_articles(brand_id);

INSERT INTO brand_layer_backfill_counts (table_name, row_count)
VALUES ('generated_articles_before', (SELECT COUNT(*) FROM public.generated_articles))
ON CONFLICT (table_name)
DO UPDATE SET row_count = EXCLUDED.row_count;

UPDATE public.generated_articles
SET brand_id = brands.id
FROM public.brands
WHERE brands.company_id = generated_articles.company_id
  AND brands.is_default = TRUE
  AND generated_articles.brand_id IS NULL
  AND generated_articles.company_id IS NOT NULL;

DO $$
DECLARE
  row_count_before INTEGER;
  row_count_after INTEGER;
  missing_brand_count INTEGER;
BEGIN
  SELECT row_count INTO row_count_before
  FROM brand_layer_backfill_counts
  WHERE table_name = 'generated_articles_before';

  SELECT COUNT(*) INTO row_count_after FROM public.generated_articles;

  IF row_count_before <> row_count_after THEN
    RAISE EXCEPTION 'generated_articles row count changed during brand backfill: before %, after %',
      row_count_before, row_count_after;
  END IF;

  SELECT COUNT(*) INTO missing_brand_count
  FROM public.generated_articles
  WHERE company_id IS NOT NULL
    AND brand_id IS NULL;

  IF missing_brand_count > 0 THEN
    RAISE EXCEPTION 'generated_articles brand backfill incomplete: % rows still have NULL brand_id',
      missing_brand_count;
  END IF;

  RAISE NOTICE 'generated_articles brand backfill verified: % rows preserved, % missing brand_id',
    row_count_after, missing_brand_count;
END $$;

COMMENT ON TABLE public.brands IS 'Company-scoped brand layer between companies and content.';
COMMENT ON TABLE public.brand_keywords IS 'Brand-scoped keyword priorities.';
COMMENT ON TABLE public.brand_performance_memory IS 'Brand-scoped performance memory for future optimization.';
COMMENT ON COLUMN public.website_configs.brand_id IS 'Owning brand for this website. Platform Blog rows keep this NULL.';
COMMENT ON COLUMN public.generated_articles.brand_id IS 'Owning brand for this article, backfilled from the company default brand.';
COMMENT ON COLUMN public.website_configs.website_type IS '網站類型：wordpress（WordPress 網站）、platform_blog（平台官方 Blog）、external（外部網站，透過 webhook 同步）、shopline（SHOPLINE 商店）';
