# Checkout E2E

`checkout.spec.ts` drives the real Stripe test-mode Checkout flow:

`/signup?plan=solo_monthly` -> `/onboarding/billing` -> Stripe Checkout -> `/onboarding/welcome`.

The test is skipped when `STRIPE_API_KEY_TEST` is not present, so CI can run
without Stripe credentials. To run it locally:

```bash
cd packages/web
op run --env-file=.env.local -- pnpm exec playwright test e2e/checkout.spec.ts --project=chromium
```

Required local setup:

- `STRIPE_API_KEY_TEST` must be available through 1Password.
- Stripe price ids must be available through `.stripe-price-ids.test.json` or
  `STRIPE_PRICE_SOLO_MONTHLY`, `STRIPE_PRICE_SOLO_YEARLY`,
  `STRIPE_PRICE_PRO_MONTHLY`, and `STRIPE_PRICE_PRO_YEARLY`.
- The app must point at a disposable Supabase environment with email
  confirmation disabled, or with confirmation links routed back to this local
  app.
