CREATE TABLE public.shopline_shop_meta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL UNIQUE REFERENCES public.website_configs(id) ON DELETE CASCADE,
  seo_title_template TEXT,
  default_description TEXT,
  robots_index_products BOOLEAN NOT NULL DEFAULT TRUE,
  robots_index_collections BOOLEAN NOT NULL DEFAULT TRUE,
  sitemap_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  default_og_image TEXT,
  hreflang_map JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX shopline_shop_meta_website_idx
  ON public.shopline_shop_meta(website_id);

ALTER TABLE public.shopline_shop_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopline_shop_meta_company_select
  ON public.shopline_shop_meta FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_shop_meta.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_shop_meta_company_insert
  ON public.shopline_shop_meta FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_shop_meta.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_shop_meta_company_update
  ON public.shopline_shop_meta FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_shop_meta.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_shop_meta.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );
