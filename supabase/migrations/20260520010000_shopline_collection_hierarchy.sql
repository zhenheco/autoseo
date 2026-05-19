CREATE TABLE public.shopline_collection_hierarchy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES public.website_configs(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL,
  parent_collection_id TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (website_id, collection_id),
  CHECK (collection_id <> parent_collection_id)
);

CREATE INDEX shopline_collection_hierarchy_website_idx
  ON public.shopline_collection_hierarchy(website_id, display_order);

CREATE INDEX shopline_collection_hierarchy_parent_idx
  ON public.shopline_collection_hierarchy(website_id, parent_collection_id);

ALTER TABLE public.shopline_collection_hierarchy ENABLE ROW LEVEL SECURITY;

CREATE POLICY shopline_collection_hierarchy_company_select
  ON public.shopline_collection_hierarchy FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_collection_hierarchy.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_collection_hierarchy_company_insert
  ON public.shopline_collection_hierarchy FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_collection_hierarchy.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_collection_hierarchy_company_update
  ON public.shopline_collection_hierarchy FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_collection_hierarchy.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_collection_hierarchy.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY shopline_collection_hierarchy_company_delete
  ON public.shopline_collection_hierarchy FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      JOIN public.website_configs wc ON wc.id = shopline_collection_hierarchy.website_id
      WHERE cm.company_id = wc.company_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );
