# Stripe Setup

## Future Work

- Referral incentives are deferred to Phase 3+. Revisit the design with Stripe Coupons or Stripe Connect instead of restoring the legacy referral tables.

## Affiliate microservice cleanup TODO

The `affiliate.1wayseo.com` microservice (separate repo) still hosts `/api/payuni/*` routes. Open a follow-up issue there to remove those routes and PAYUNi env vars. Retain only `/api/amego/*` and the planned `/api/stripe/*` for the Stripe→Amego adapter.
