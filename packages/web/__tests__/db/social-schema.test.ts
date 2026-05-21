import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";
import type { Database } from "../../src/types/database.types";

const repoRoot = process.cwd().endsWith("packages/web")
  ? join(process.cwd(), "../..")
  : process.cwd();
const migrationsDir = join(repoRoot, "supabase/migrations");
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_create_social_schema.sql"),
);
const migrationSql = migrationFile
  ? readFileSync(join(migrationsDir, migrationFile), "utf8")
  : "";

const databaseUrl = process.env.SOCIAL_SCHEMA_TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

type ColumnRow = {
  table_name: string;
  column_name: string;
};

function assertLocalDatabase(url: string) {
  if (process.env.SOCIAL_SCHEMA_ALLOW_REMOTE === "1") {
    return;
  }

  const parsed = new URL(url);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      "Refusing to run DB migration tests against a non-local database. Set SOCIAL_SCHEMA_ALLOW_REMOTE=1 only for disposable databases.",
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

describe("social schema migration file", () => {
  it("exposes generated Database types for social tables", () => {
    expectTypeOf<
      Database["public"]["Tables"]["social_accounts"]["Row"]
    >().toMatchTypeOf<{
      id: string;
      brand_id: string;
      platform: "instagram" | "threads" | "facebook" | "x" | "linkedin";
      platform_account_id: string;
      access_token_encrypted: string;
      refresh_token_encrypted: string | null;
      disconnected_at: string | null;
    }>();

    expectTypeOf<
      Database["public"]["Tables"]["social_posts"]["Insert"]
    >().toMatchTypeOf<{
      scheduled_at: string;
      social_account_id?: string | null;
      status?:
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "cancelled";
      media_urls?: string[] | null;
      metrics?: Database["public"]["Tables"]["social_posts"]["Insert"]["metrics"];
    }>();
  });

  it("creates social tables, indexes, unique key, and all RLS policies", () => {
    expect(migrationFile).toBeDefined();
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS public.social_accounts",
    );
    expect(migrationSql).toContain(
      "CREATE TABLE IF NOT EXISTS public.social_posts",
    );
    expect(migrationSql).toContain("legacy_social_accounts_pre_brand_layer");
    expect(migrationSql).toContain("legacy_social_posts_pre_brand_layer");
    expect(migrationSql).toContain(
      "UNIQUE (brand_id, platform, platform_account_id)",
    );
    expect(migrationSql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_social_accounts_brand",
    );
    expect(migrationSql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled",
    );
    expect(migrationSql).toContain(
      "ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY",
    );
    expect(migrationSql).toContain(
      "ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY",
    );

    for (const table of ["social_accounts", "social_posts"]) {
      for (const action of ["select", "insert", "update", "delete"]) {
        expect(migrationSql).toContain(`${table}_${action}`);
      }
    }

    expect(migrationSql).toContain(
      "public.brand_layer_user_has_company_access",
    );
  });
});

describeDb("social schema migration against local Supabase", () => {
  let client: Client;
  const ids = {
    user: randomUUID(),
    company: randomUUID(),
    brand: randomUUID(),
    account: randomUUID(),
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
      [ids.user, `social-schema-${ids.user}@example.test`],
    );
    await client.query(
      `
        INSERT INTO public.companies (id, name, slug, owner_id)
        VALUES ($1, 'Social Schema Company', $2, $3)
      `,
      [ids.company, `social-schema-${ids.company}`, ids.user],
    );
    await client.query(
      `
        INSERT INTO public.company_members (company_id, user_id, role, status, joined_at)
        VALUES ($1, $2, 'owner', 'active', NOW())
      `,
      [ids.company, ids.user],
    );
    await client.query(
      `
        INSERT INTO public.brands (id, company_id, name)
        VALUES ($1, $2, 'Social Schema Brand')
      `,
      [ids.brand, ids.company],
    );
  });

  afterAll(async () => {
    if (!client) {
      return;
    }

    await client.query("ROLLBACK");
    await client.end();
  });

  it("creates documented columns and enables RLS", async () => {
    const columns = await client.query<ColumnRow>(
      `
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name, ordinal_position
      `,
      [["social_accounts", "social_posts"]],
    );

    const tableColumns = columns.rows.reduce<Record<string, Set<string>>>(
      (acc, row) => {
        acc[row.table_name] ??= new Set();
        acc[row.table_name].add(row.column_name);
        return acc;
      },
      {},
    );

    expect(tableColumns.social_accounts).toEqual(
      new Set([
        "id",
        "brand_id",
        "platform",
        "platform_account_id",
        "platform_username",
        "access_token_encrypted",
        "refresh_token_encrypted",
        "token_expires_at",
        "connected_at",
        "disconnected_at",
      ]),
    );
    expect(tableColumns.social_posts).toEqual(
      new Set([
        "id",
        "article_id",
        "social_account_id",
        "platform_post_id",
        "scheduled_at",
        "published_at",
        "status",
        "content_text",
        "media_urls",
        "error_message",
        "retry_count",
        "metrics",
        "metrics_updated_at",
        "created_at",
      ]),
    );

    const rls = await client.query<{
      relname: string;
      relrowsecurity: boolean;
    }>(
      `
        SELECT relname, relrowsecurity
        FROM pg_class
        WHERE oid = ANY($1::regclass[])
      `,
      [["public.social_accounts", "public.social_posts"]],
    );
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);
  });

  it("creates four policies per table", async () => {
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
      [["social_accounts", "social_posts"]],
    );

    expect(
      Object.fromEntries(
        policyCounts.rows.map((row) => [row.tablename, row.count]),
      ),
    ).toEqual({
      social_accounts: "4",
      social_posts: "4",
    });
  });

  it("rejects duplicate social accounts for the same brand platform account", async () => {
    await client.query(
      `
        INSERT INTO public.social_accounts (
          id,
          brand_id,
          platform,
          platform_account_id,
          access_token_encrypted
        )
        VALUES ($1, $2, 'instagram', 'acct-1', 'encrypted-token')
      `,
      [ids.account, ids.brand],
    );

    await expectUniqueViolation(
      client,
      `
        INSERT INTO public.social_accounts (
          brand_id,
          platform,
          platform_account_id,
          access_token_encrypted
        )
        VALUES ($1, 'instagram', 'acct-1', 'encrypted-token-2')
      `,
      [ids.brand],
    );
  });
});
