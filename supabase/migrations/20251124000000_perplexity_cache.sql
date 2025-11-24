-- Create perplexity_cache table for caching competitor research results
-- This reduces API costs and improves performance

CREATE TABLE IF NOT EXISTS public.perplexity_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  query_type TEXT NOT NULL CHECK (query_type IN ('competitor_research', 'industry_analysis', 'market_trends')),
  query_params JSONB NOT NULL,
  response_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(company_id, query_hash)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_perplexity_cache_lookup
  ON public.perplexity_cache(company_id, query_hash, expires_at);

-- Create index for cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_perplexity_cache_expires
  ON public.perplexity_cache(expires_at);

-- Enable RLS
ALTER TABLE public.perplexity_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access cache entries for their own company
CREATE POLICY "Users can access their company's cache"
  ON public.perplexity_cache
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id
      FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Service role can insert cache entries
CREATE POLICY "Service role can insert cache"
  ON public.perplexity_cache
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Service role can delete expired cache entries
CREATE POLICY "Service role can delete expired cache"
  ON public.perplexity_cache
  FOR DELETE
  USING (true);

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.perplexity_cache
  WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.cleanup_expired_cache() TO service_role;

COMMENT ON TABLE public.perplexity_cache IS 'Caches Perplexity API responses to reduce costs';
COMMENT ON COLUMN public.perplexity_cache.query_hash IS 'SHA-256 hash of query parameters for deduplication';
COMMENT ON COLUMN public.perplexity_cache.query_type IS 'Type of query (competitor_research, industry_analysis, market_trends)';
COMMENT ON COLUMN public.perplexity_cache.query_params IS 'Original query parameters as JSON';
COMMENT ON COLUMN public.perplexity_cache.response_data IS 'Cached API response as JSON';
COMMENT ON COLUMN public.perplexity_cache.expires_at IS 'Cache expiration timestamp (default 7 days from creation)';
