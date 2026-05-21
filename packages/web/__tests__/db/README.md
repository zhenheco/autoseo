# Database Migration Tests

These tests validate Supabase migrations against a disposable local database.

## Stripe Schema Test

1. Start local Supabase and apply baseline migrations:

   ```bash
   supabase start
   supabase db reset
   ```

2. Run the test with the local database URL:

   ```bash
   STRIPE_SCHEMA_TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
     pnpm --filter @seo/web vitest run __tests__/db/stripe-schema.test.ts
   ```

The test applies the Stripe migration inside a transaction, inserts temporary
rows for uniqueness checks, and rolls everything back at the end.

By default the test refuses non-local hosts. For a disposable remote database,
set `STRIPE_SCHEMA_ALLOW_REMOTE=1`. Do not point this test at production.
