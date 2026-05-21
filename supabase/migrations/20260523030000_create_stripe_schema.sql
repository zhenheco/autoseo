-- Stripe schema for trials, invoices, webhook idempotency, and refunds.
-- DECIMAL(10,2) amount columns support up to 99,999,999.99, which is sufficient
-- for foreseeable customer invoices and refunds while preserving cent precision.

CREATE TABLE IF NOT EXISTS public.trials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  plan_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trials_active_per_user
  ON public.trials(user_id)
  WHERE converted_at IS NULL AND cancelled_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_trials_ends_at
  ON public.trials(ends_at)
  WHERE converted_at IS NULL AND cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  amount_twd DECIMAL(10,2),
  billing_country TEXT NOT NULL,
  amego_invoice_number TEXT,
  amego_issued_at TIMESTAMPTZ,
  amego_status TEXT CHECK (amego_status IN ('pending','issued','failed','not_applicable')),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_company
  ON public.invoices(company_id);

CREATE INDEX IF NOT EXISTS idx_invoices_amego_status
  ON public.invoices(amego_status)
  WHERE amego_status IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_received
  ON public.stripe_events(received_at);

CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_refund_id TEXT UNIQUE NOT NULL,
  stripe_invoice_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  amount_usd DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed','cancelled')),
  initiated_by TEXT,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_refunds_company
  ON public.refunds(company_id);

ALTER TABLE public.company_subscriptions
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_card_added_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS billing_country TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_subscriptions_stripe_subscription_id
  ON public.company_subscriptions(stripe_subscription_id);

ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trials' AND policyname = 'users read own trials'
  ) THEN
    CREATE POLICY "users read own trials" ON public.trials FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = trials.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trials' AND policyname = 'users insert own trials'
  ) THEN
    CREATE POLICY "users insert own trials" ON public.trials FOR INSERT TO authenticated
      WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = trials.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trials' AND policyname = 'service updates trials'
  ) THEN
    CREATE POLICY "service updates trials" ON public.trials FOR UPDATE TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'trials' AND policyname = 'users delete own trials'
  ) THEN
    CREATE POLICY "users delete own trials" ON public.trials FOR DELETE TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'users read own invoices'
  ) THEN
    CREATE POLICY "users read own invoices" ON public.invoices FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = invoices.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'service inserts invoices'
  ) THEN
    CREATE POLICY "service inserts invoices" ON public.invoices FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'service updates invoices'
  ) THEN
    CREATE POLICY "service updates invoices" ON public.invoices FOR UPDATE TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'service deletes invoices'
  ) THEN
    CREATE POLICY "service deletes invoices" ON public.invoices FOR DELETE TO service_role
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stripe_events' AND policyname = 'service reads stripe events'
  ) THEN
    CREATE POLICY "service reads stripe events" ON public.stripe_events FOR SELECT TO service_role
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stripe_events' AND policyname = 'service inserts stripe events'
  ) THEN
    CREATE POLICY "service inserts stripe events" ON public.stripe_events FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stripe_events' AND policyname = 'service updates stripe events'
  ) THEN
    CREATE POLICY "service updates stripe events" ON public.stripe_events FOR UPDATE TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stripe_events' AND policyname = 'service deletes stripe events'
  ) THEN
    CREATE POLICY "service deletes stripe events" ON public.stripe_events FOR DELETE TO service_role
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'refunds' AND policyname = 'users read own refunds'
  ) THEN
    CREATE POLICY "users read own refunds" ON public.refunds FOR SELECT TO authenticated
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.company_members cm
          WHERE cm.company_id = refunds.company_id
            AND cm.user_id = auth.uid()
            AND cm.status = 'active'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'refunds' AND policyname = 'service inserts refunds'
  ) THEN
    CREATE POLICY "service inserts refunds" ON public.refunds FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'refunds' AND policyname = 'service updates refunds'
  ) THEN
    CREATE POLICY "service updates refunds" ON public.refunds FOR UPDATE TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'refunds' AND policyname = 'service deletes refunds'
  ) THEN
    CREATE POLICY "service deletes refunds" ON public.refunds FOR DELETE TO service_role
      USING (true);
  END IF;
END $$;
