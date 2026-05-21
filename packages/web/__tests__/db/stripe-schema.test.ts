import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { describe, expect, it, beforeAll, afterAll } from "vitest";

const repoRoot = process.cwd().endsWith("packages/web")
  ? join(process.cwd(), "../..")
  : process.cwd();
const migrationsDir = join(repoRoot, "supabase/migrations");
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_create_stripe_schema.sql"),
);
const migrationSql = migrationFile
  ? readFileSync(join(migrationsDir, migrationFile), "utf8")
  : "";

const databaseUrl = process.env.STRIPE_SCHEMA_TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

type ColumnRow = {
  table_name: string;
  column_name: string;
  data_type: string;
  numeric_precision: number | null;
  numeric_scale: number | null;
};

function assertLocalDatabase(url: string) {
  if (process.env.STRIPE_SCHEMA_ALLOW_REMOTE === "1") {
    return;
  }

  const parsed = new URL(url);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      "Refusing to run DB migration tests against a non-local database. Set STRIPE_SCHEMA_ALLOW_REMOTE=1 only for disposable databases.",
    );
  }
}

async function expectUniqueViolation(
  client: Client,
  sql: string,
  params: unknown[],
) {
  await client.query("SAVEPOINT expect_unique_violation");
  try {
    await client.query(sql, params);
    throw new Error("Expected unique violation");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT expect_unique_violation");
    expect((error as { code?: string }).code).toBe("23505");
  } finally {
    await client.query("RELEASE SAVEPOINT expect_unique_violation");
  }
}

describe("stripe schema migration file", () => {
  it("exists and contains the expected Stripe-side tables", () => {
    expect(migrationFile).toBeDefined();
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.trials");
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS public.invoices",
    );
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS public.stripe_events",
    );
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.refunds");
    expect(migrationSql).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_company_subscriptions_stripe_subscription_id",
    );
    expect(migrationSql).not.toMatch(/\bDROP\b/i);
  });
});

describeDb("stripe schema migration against local Supabase", () => {
  let client: Client;
  const ids = {
    user: randomUUID(),
    companyA: randomUUID(),
    companyB: randomUUID(),
    plan: randomUUID(),
  };

  beforeAll(async () => {
    expect(migrationFile).toBeDefined();
    assertLocalDatabase(databaseUrl!);

    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query("BEGIN");
    await client.query(migrationSql);

    await client.query(
      `
        INSERT INTO auth.users (
          id,
          instance_id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          '00000000-0000-0000-0000-000000000000',
          'authenticated',
          'authenticated',
          $2,
          '',
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
      `,
      [ids.user, `stripe-schema-${ids.user}@example.test`],
    );
    await client.query(
      `
        INSERT INTO public.companies (id, name, slug, owner_id)
        VALUES
          ($1, 'Stripe Schema A', $2, $3),
          ($4, 'Stripe Schema B', $5, $3)
      `,
      [
        ids.companyA,
        `stripe-schema-a-${ids.companyA}`,
        ids.user,
        ids.companyB,
        `stripe-schema-b-${ids.companyB}`,
      ],
    );
    await client.query(
      `
        INSERT INTO public.company_members (company_id, user_id, role, status, joined_at)
        VALUES
          ($1, $2, 'owner', 'active', NOW()),
          ($3, $2, 'owner', 'active', NOW())
      `,
      [ids.companyA, ids.user, ids.companyB],
    );
    await client.query(
      `
        INSERT INTO public.subscription_plans (id, name, slug, monthly_price)
        VALUES ($1, 'Stripe Schema Test', $2, 0)
      `,
      [ids.plan, `stripe-schema-${ids.plan}`],
    );
  });

  afterAll(async () => {
    if (!client) {
      return;
    }

    await client.query("ROLLBACK");
    await client.end();
  });

  it("creates documented columns, constraints, indexes, and RLS policies", async () => {
    const columns = await client.query<ColumnRow>(
      `
        SELECT table_name, column_name, data_type, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position
      `,
      [["trials", "invoices", "stripe_events", "refunds"]],
    );

    const tableColumns = columns.rows.reduce<Record<string, Set<string>>>(
      (acc, row) => {
        acc[row.table_name] ??= new Set();
        acc[row.table_name].add(row.column_name);
        return acc;
      },
      {},
    );

    expect(tableColumns.trials).toEqual(
      new Set([
        "id",
        "user_id",
        "company_id",
        "plan_id",
        "started_at",
        "ends_at",
        "converted_at",
        "cancelled_at",
        "stripe_subscription_id",
        "card_brand",
        "card_last4",
        "created_at",
      ]),
    );
    expect(tableColumns.invoices).toEqual(
      new Set([
        "id",
        "stripe_invoice_id",
        "user_id",
        "company_id",
        "amount_usd",
        "amount_twd",
        "billing_country",
        "amego_invoice_number",
        "amego_issued_at",
        "amego_status",
        "paid_at",
        "created_at",
      ]),
    );
    expect(tableColumns.stripe_events).toEqual(
      new Set([
        "stripe_event_id",
        "event_type",
        "received_at",
        "processed_at",
        "payload",
      ]),
    );
    expect(tableColumns.refunds).toEqual(
      new Set([
        "id",
        "stripe_refund_id",
        "stripe_invoice_id",
        "user_id",
        "company_id",
        "amount_usd",
        "reason",
        "status",
        "initiated_by",
        "initiated_at",
        "resolved_at",
      ]),
    );

    const decimalColumns = columns.rows.filter((row) =>
      ["amount_usd", "amount_twd"].includes(row.column_name),
    );
    expect(decimalColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table_name: "invoices",
          column_name: "amount_usd",
          numeric_precision: 10,
          numeric_scale: 2,
        }),
        expect.objectContaining({
          table_name: "refunds",
          column_name: "amount_usd",
          numeric_precision: 10,
          numeric_scale: 2,
        }),
      ]),
    );

    const companySubscriptionColumns = await client.query<{
      column_name: string;
    }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'company_subscriptions'
          AND column_name = ANY($1::text[])
      `,
      [
        [
          "provider",
          "stripe_customer_id",
          "stripe_subscription_id",
          "trial_ends_at",
          "trial_card_added_at",
          "currency",
          "billing_country",
        ],
      ],
    );
    expect(
      companySubscriptionColumns.rows.map((row) => row.column_name).sort(),
    ).toEqual([
      "billing_country",
      "currency",
      "provider",
      "stripe_customer_id",
      "stripe_subscription_id",
      "trial_card_added_at",
      "trial_ends_at",
    ]);

    const indexes = await client.query<{ indexname: string }>(
      `
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = ANY($1::text[])
      `,
      [
        [
          "idx_trials_active_per_user",
          "idx_trials_ends_at",
          "idx_invoices_company",
          "idx_invoices_amego_status",
          "idx_stripe_events_received",
          "idx_refunds_company",
          "idx_company_subscriptions_stripe_subscription_id",
        ],
      ],
    );
    expect(new Set(indexes.rows.map((row) => row.indexname))).toEqual(
      new Set([
        "idx_trials_active_per_user",
        "idx_trials_ends_at",
        "idx_invoices_company",
        "idx_invoices_amego_status",
        "idx_stripe_events_received",
        "idx_refunds_company",
        "idx_company_subscriptions_stripe_subscription_id",
      ]),
    );

    const constraints = await client.query<{ constraint_def: string }>(
      `
        SELECT pg_get_constraintdef(oid) AS constraint_def
        FROM pg_constraint
        WHERE conrelid IN (
          'public.invoices'::regclass,
          'public.refunds'::regclass,
          'public.company_subscriptions'::regclass
        )
      `,
    );
    const constraintSql = constraints.rows
      .map((row) => row.constraint_def)
      .join("\n");
    expect(constraintSql).toContain(
      "CHECK ((amego_status = ANY (ARRAY['pending'::text, 'issued'::text, 'failed'::text, 'not_applicable'::text])))",
    );
    expect(constraintSql).toContain(
      "CHECK ((status = ANY (ARRAY['pending'::text, 'succeeded'::text, 'failed'::text, 'cancelled'::text])))",
    );
    expect(constraintSql).toContain("CHECK ((provider = 'stripe'::text))");

    const rls = await client.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      `
        SELECT relname, relrowsecurity
        FROM pg_class
        WHERE oid = ANY($1::regclass[])
      `,
      [
        [
          "public.trials",
          "public.invoices",
          "public.stripe_events",
          "public.refunds",
        ],
      ],
    );
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);

    const policyCounts = await client.query<{
      tablename: string;
      count: string;
    }>(
      `
        SELECT tablename, COUNT(*)::text AS count
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = ANY($1::text[])
        GROUP BY tablename
      `,
      [["trials", "invoices", "stripe_events", "refunds"]],
    );
    expect(
      Object.fromEntries(
        policyCounts.rows.map((row) => [row.tablename, row.count]),
      ),
    ).toEqual({
      invoices: "4",
      refunds: "4",
      stripe_events: "4",
      trials: "4",
    });
  });

  it("rejects duplicate company_subscriptions.stripe_subscription_id values", async () => {
    const stripeSubscriptionId = `sub_${randomUUID()}`;

    await client.query(
      `
        INSERT INTO public.company_subscriptions (
          company_id,
          plan_id,
          status,
          monthly_token_quota,
          stripe_subscription_id
        )
        VALUES ($1, $2, 'active', 100, $3)
      `,
      [ids.companyA, ids.plan, stripeSubscriptionId],
    );

    await expectUniqueViolation(
      client,
      `
        INSERT INTO public.company_subscriptions (
          company_id,
          plan_id,
          status,
          monthly_token_quota,
          stripe_subscription_id
        )
        VALUES ($1, $2, 'active', 100, $3)
      `,
      [ids.companyB, ids.plan, stripeSubscriptionId],
    );
  });

  it("rejects two active trials for the same user", async () => {
    await client.query(
      `
        INSERT INTO public.trials (user_id, company_id, plan_id, ends_at)
        VALUES ($1, $2, 'starter', NOW() + INTERVAL '7 days')
      `,
      [ids.user, ids.companyA],
    );

    await expectUniqueViolation(
      client,
      `
        INSERT INTO public.trials (user_id, company_id, plan_id, ends_at)
        VALUES ($1, $2, 'pro', NOW() + INTERVAL '7 days')
      `,
      [ids.user, ids.companyB],
    );
  });

  it("rejects duplicate stripe_events.stripe_event_id values", async () => {
    const stripeEventId = `evt_${randomUUID()}`;

    await client.query(
      `
        INSERT INTO public.stripe_events (stripe_event_id, event_type, payload)
        VALUES ($1, 'invoice.paid', '{"id":"evt"}'::jsonb)
      `,
      [stripeEventId],
    );

    await expectUniqueViolation(
      client,
      `
        INSERT INTO public.stripe_events (stripe_event_id, event_type, payload)
        VALUES ($1, 'invoice.paid', '{"id":"evt-duplicate"}'::jsonb)
      `,
      [stripeEventId],
    );
  });
});
