CREATE TABLE public.article_performance (
  article_id UUID REFERENCES public.generated_articles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('ga4','gsc','wordpress','social')),
  pageviews INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  avg_session_seconds DECIMAL(10,2),
  conversions INTEGER NOT NULL DEFAULT 0,
  ctr DECIMAL(5,4),
  position DECIMAL(5,2),
  raw_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (article_id, date, source)
);

CREATE INDEX idx_article_perf_date
  ON public.article_performance(date, source);

CREATE INDEX idx_article_perf_top
  ON public.article_performance(date DESC, pageviews DESC);

ALTER TABLE public.article_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY article_performance_company_select
  ON public.article_performance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_performance.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY article_performance_company_insert
  ON public.article_performance FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_performance.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY article_performance_company_update
  ON public.article_performance FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_performance.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_performance.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY article_performance_company_delete
  ON public.article_performance FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.generated_articles ga
      JOIN public.company_members cm ON cm.company_id = ga.company_id
      WHERE ga.id = article_performance.article_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

REVOKE ALL ON public.article_performance FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_performance TO authenticated;
GRANT ALL ON public.article_performance TO service_role;
