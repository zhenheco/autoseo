CREATE TABLE IF NOT EXISTS public.shopline_install_invitations (
  token UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  expected_shop_handle TEXT CHECK (expected_shop_handle IS NULL OR expected_shop_handle ~ '^[A-Za-z0-9-]+$'),
  note TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_redeemed_at TIMESTAMPTZ,
  redeem_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopline_invitations_company
  ON public.shopline_install_invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_shopline_invitations_active
  ON public.shopline_install_invitations(token)
  WHERE revoked_at IS NULL;

ALTER TABLE public.shopline_install_invitations ENABLE ROW LEVEL SECURITY;

-- All access via service_role (admin actions + public install API use admin client).
REVOKE ALL ON public.shopline_install_invitations FROM anon;
REVOKE ALL ON public.shopline_install_invitations FROM authenticated;
GRANT ALL ON public.shopline_install_invitations TO service_role;

COMMENT ON TABLE public.shopline_install_invitations IS 'SHOPLINE OAuth pre-issued invitation tokens for merchants without dashboard accounts.';
