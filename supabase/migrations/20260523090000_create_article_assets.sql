CREATE TABLE IF NOT EXISTS public.article_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.generated_articles(id) ON DELETE CASCADE NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('card','image','video')),
  template TEXT,
  size TEXT,
  r2_url TEXT NOT NULL,
  brand_id UUID REFERENCES public.brands(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_article_assets_article
  ON public.article_assets(article_id);

CREATE INDEX IF NOT EXISTS idx_article_assets_brand
  ON public.article_assets(brand_id)
  WHERE brand_id IS NOT NULL;

ALTER TABLE public.article_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS article_assets_company_select ON public.article_assets;
CREATE POLICY article_assets_company_select
  ON public.article_assets FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_assets.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

DROP POLICY IF EXISTS article_assets_company_insert ON public.article_assets;
CREATE POLICY article_assets_company_insert
  ON public.article_assets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_assets.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          article_assets.brand_id IS NULL
          OR article_assets.brand_id = ga.brand_id
          OR EXISTS (
            SELECT 1
            FROM public.brands b
            WHERE b.id = article_assets.brand_id
              AND b.company_id = ga.company_id
          )
        )
    )
  );

DROP POLICY IF EXISTS article_assets_company_update ON public.article_assets;
CREATE POLICY article_assets_company_update
  ON public.article_assets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_assets.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_assets.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND (
          article_assets.brand_id IS NULL
          OR article_assets.brand_id = ga.brand_id
          OR EXISTS (
            SELECT 1
            FROM public.brands b
            WHERE b.id = article_assets.brand_id
              AND b.company_id = ga.company_id
          )
        )
    )
  );

DROP POLICY IF EXISTS article_assets_company_delete ON public.article_assets;
CREATE POLICY article_assets_company_delete
  ON public.article_assets FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_assets.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );
