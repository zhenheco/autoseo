CREATE TABLE IF NOT EXISTS public.dunning_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_invoice_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  dunning_day INTEGER NOT NULL CHECK (dunning_day IN (1, 3, 7)),
  template TEXT NOT NULL CHECK (
    template IN (
      'payment_failed_d1',
      'payment_failed_d3',
      'payment_failed_d7'
    )
  ),
  idempotency_key TEXT UNIQUE NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'cancelled', 'failed', 'suppressed')
  ),
  sent_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dunning_schedules_invoice
  ON public.dunning_schedules(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_dunning_schedules_due
  ON public.dunning_schedules(scheduled_for)
  WHERE status = 'pending';

ALTER TABLE public.dunning_schedules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_schedules'
      AND policyname = 'service reads dunning schedules'
  ) THEN
    CREATE POLICY "service reads dunning schedules"
      ON public.dunning_schedules FOR SELECT TO service_role
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_schedules'
      AND policyname = 'service inserts dunning schedules'
  ) THEN
    CREATE POLICY "service inserts dunning schedules"
      ON public.dunning_schedules FOR INSERT TO service_role
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_schedules'
      AND policyname = 'service updates dunning schedules'
  ) THEN
    CREATE POLICY "service updates dunning schedules"
      ON public.dunning_schedules FOR UPDATE TO service_role
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'dunning_schedules'
      AND policyname = 'service deletes dunning schedules'
  ) THEN
    CREATE POLICY "service deletes dunning schedules"
      ON public.dunning_schedules FOR DELETE TO service_role
      USING (true);
  END IF;
END $$;
