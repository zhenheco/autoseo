-- Mark free plan as deprecated; do not delete row (FK protection).
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS deprecated_at TIMESTAMPTZ;

UPDATE public.subscription_plans
SET
  is_active = FALSE,
  deprecated_at = COALESCE(deprecated_at, NOW())
WHERE id::text = 'free'
   OR slug = 'free'
   OR name = 'Free'
   OR name ILIKE '%free%';

-- New signups should not receive a legacy complimentary tier by default.
ALTER TABLE public.companies
  ALTER COLUMN subscription_tier DROP DEFAULT;

-- Path 1 helper marks contacted accounts while Ace moves them to Stripe trials.
ALTER TABLE public.company_subscriptions
  DROP CONSTRAINT IF EXISTS company_subscriptions_status_check;

ALTER TABLE public.company_subscriptions
  ADD CONSTRAINT company_subscriptions_status_check
  CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing', 'grandfather_trial'));
