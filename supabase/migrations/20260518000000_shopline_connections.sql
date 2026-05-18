-- ===========================================
-- SHOPLINE OAuth connections
-- ===========================================

-- SHOPLINE tokens reuse the existing `api_keys` pgsodium key via
-- encrypt_data/decrypt_data. Production DB roles cannot create pgsodium keys,
-- and SHOPLINE access tokens have the same secret class as external API keys.

CREATE TABLE IF NOT EXISTS public.shopline_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  website_id UUID NOT NULL REFERENCES public.website_configs(id) ON DELETE CASCADE,
  shop_handle TEXT NOT NULL CHECK (shop_handle ~ '^[A-Za-z0-9-]+$'),
  shop_domain TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
  last_verified_at TIMESTAMPTZ,
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, website_id),
  UNIQUE(company_id, shop_handle)
);

CREATE INDEX IF NOT EXISTS idx_shopline_connections_company
  ON public.shopline_connections(company_id);

CREATE INDEX IF NOT EXISTS idx_shopline_connections_website
  ON public.shopline_connections(website_id);

CREATE INDEX IF NOT EXISTS idx_shopline_connections_shop
  ON public.shopline_connections(company_id, shop_handle);

CREATE INDEX IF NOT EXISTS idx_shopline_connections_active
  ON public.shopline_connections(company_id, status)
  WHERE status = 'active';

ALTER TABLE public.shopline_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company shopline connection metadata"
  ON public.shopline_connections;

CREATE POLICY "Users can view their company shopline connection metadata"
  ON public.shopline_connections FOR SELECT
  USING (
    company_id IN (
      SELECT company_id
      FROM public.company_members
      WHERE user_id = auth.uid()
        AND status = 'active'
    )
  );

-- Writes go through service-role API routes so token encryption and operation
-- logging stay centralized.
REVOKE ALL ON public.shopline_connections FROM anon;
REVOKE ALL ON public.shopline_connections FROM authenticated;
GRANT ALL ON public.shopline_connections TO service_role;

COMMENT ON TABLE public.shopline_connections IS 'SHOPLINE OAuth/customer app connections. access_token_encrypted must never be returned to browser clients.';
COMMENT ON COLUMN public.shopline_connections.access_token_encrypted IS 'Encrypted SHOPLINE access token using the api_keys pgsodium key via encrypt_data/decrypt_data.';
COMMENT ON COLUMN public.shopline_connections.granted_scopes IS 'SHOPLINE scopes granted by the merchant.';
