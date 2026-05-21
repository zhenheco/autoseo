DO $$
BEGIN
  IF to_regclass('public.social_accounts') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'social_accounts'
        AND column_name = 'brand_id'
    )
  THEN
    IF to_regclass('public.social_posts') IS NOT NULL THEN
      ALTER TABLE public.social_posts RENAME TO legacy_social_posts_pre_brand_layer;
    END IF;

    ALTER TABLE public.social_accounts RENAME TO legacy_social_accounts_pre_brand_layer;
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_social_accounts_company;
DROP INDEX IF EXISTS public.idx_social_accounts_platform;
DROP INDEX IF EXISTS public.idx_social_posts_company;
DROP INDEX IF EXISTS public.idx_social_posts_article;
DROP INDEX IF EXISTS public.idx_social_posts_status;
DROP INDEX IF EXISTS public.idx_social_posts_scheduled;

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram','threads','facebook','x','linkedin')),
  platform_account_id TEXT NOT NULL,
  platform_username TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disconnected_at TIMESTAMPTZ,
  UNIQUE (brand_id, platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_brand
  ON public.social_accounts(brand_id)
  WHERE disconnected_at IS NULL;

CREATE TABLE IF NOT EXISTS public.social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.generated_articles(id) ON DELETE CASCADE,
  social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
  platform_post_id TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','publishing','published','failed','cancelled')),
  content_text TEXT,
  media_urls TEXT[],
  error_message TEXT,
  retry_count SMALLINT NOT NULL DEFAULT 0,
  metrics JSONB,
  metrics_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled
  ON public.social_posts(scheduled_at, status)
  WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_social_posts_article
  ON public.social_posts(article_id);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_accounts_select ON public.social_accounts;
CREATE POLICY social_accounts_select
  ON public.social_accounts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = social_accounts.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_accounts_insert ON public.social_accounts;
CREATE POLICY social_accounts_insert
  ON public.social_accounts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = social_accounts.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_accounts_update ON public.social_accounts;
CREATE POLICY social_accounts_update
  ON public.social_accounts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = social_accounts.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = social_accounts.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_accounts_delete ON public.social_accounts;
CREATE POLICY social_accounts_delete
  ON public.social_accounts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.brands
      WHERE brands.id = social_accounts.brand_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_posts_select ON public.social_posts;
CREATE POLICY social_posts_select
  ON public.social_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_accounts
      JOIN public.brands ON brands.id = social_accounts.brand_id
      WHERE social_accounts.id = social_posts.social_account_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_posts_insert ON public.social_posts;
CREATE POLICY social_posts_insert
  ON public.social_posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.social_accounts
      JOIN public.brands ON brands.id = social_accounts.brand_id
      WHERE social_accounts.id = social_posts.social_account_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_posts_update ON public.social_posts;
CREATE POLICY social_posts_update
  ON public.social_posts FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_accounts
      JOIN public.brands ON brands.id = social_accounts.brand_id
      WHERE social_accounts.id = social_posts.social_account_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.social_accounts
      JOIN public.brands ON brands.id = social_accounts.brand_id
      WHERE social_accounts.id = social_posts.social_account_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

DROP POLICY IF EXISTS social_posts_delete ON public.social_posts;
CREATE POLICY social_posts_delete
  ON public.social_posts FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.social_accounts
      JOIN public.brands ON brands.id = social_accounts.brand_id
      WHERE social_accounts.id = social_posts.social_account_id
        AND public.brand_layer_user_has_company_access(brands.company_id)
    )
  );

REVOKE ALL ON public.social_accounts FROM anon;
REVOKE ALL ON public.social_posts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_posts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
GRANT ALL ON public.social_posts TO service_role;
