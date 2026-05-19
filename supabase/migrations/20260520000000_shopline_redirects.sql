CREATE TABLE public.shopline_redirects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.website_configs(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('product','collection','page')),
  entity_id TEXT,
  handle_from TEXT NOT NULL,
  handle_to TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMPTZ,
  hit_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (website_id, entity_type, handle_from)
);

CREATE INDEX shopline_redirects_website_idx
  ON public.shopline_redirects(website_id, created_at DESC);

ALTER TABLE public.shopline_redirects ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopline_redirects_company_select
  ON public.shopline_redirects FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_redirects.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_redirects_company_insert
  ON public.shopline_redirects FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_redirects.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_redirects_company_delete
  ON public.shopline_redirects FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_redirects.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );
