ALTER TABLE public.article_jobs
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_article_jobs_brand_id
  ON public.article_jobs(brand_id);

COMMENT ON COLUMN public.article_jobs.brand_id IS
  'Brand context selected for queued article generation jobs.';
