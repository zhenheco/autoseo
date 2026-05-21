import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = process.cwd().endsWith("packages/web")
  ? join(process.cwd(), "../..")
  : process.cwd();
const migrationsDir = join(repoRoot, "supabase/migrations");
const migrationFile = readdirSync(migrationsDir).find((file) =>
  file.endsWith("_add_brand_automation_columns.sql"),
);
const migrationSql = migrationFile
  ? readFileSync(join(migrationsDir, migrationFile), "utf8")
  : "";

const databaseUrl = process.env.BRAND_AUTOMATION_TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

function assertLocalDatabase(url: string) {
  if (process.env.BRAND_AUTOMATION_ALLOW_REMOTE === "1") {
    return;
  }

  const parsed = new URL(url);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
  if (!localHosts.has(parsed.hostname)) {
    throw new Error(
      "Refusing to run DB migration tests against a non-local database. Set BRAND_AUTOMATION_ALLOW_REMOTE=1 only for disposable databases.",
    );
  }
}

async function expectCheckViolation(
  client: Client,
  sql: string,
  params: unknown[],
) {
  await client.query("SAVEPOINT expect_check_violation");
  try {
    await client.query(sql, params);
    throw new Error("Expected check violation");
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT expect_check_violation");
    expect((error as { code?: string }).code).toBe("23514");
  } finally {
    await client.query("RELEASE SAVEPOINT expect_check_violation");
  }
}

describe("brand automation migration file", () => {
  it("adds bounded automation settings to brands", () => {
    expect(migrationFile).toBeDefined();
    expect(migrationSql).toContain("ALTER TABLE public.brands");
    expect(migrationSql).toContain(
      "automation_level SMALLINT NOT NULL DEFAULT 1",
    );
    expect(migrationSql).toContain("CHECK (automation_level BETWEEN 1 AND 4)");
    expect(migrationSql).toContain(
      "auto_articles_per_week SMALLINT NOT NULL DEFAULT 0",
    );
    expect(migrationSql).toContain(
      "CHECK (auto_articles_per_week BETWEEN 0 AND 14)",
    );
    expect(migrationSql).toContain(
      "auto_publish_to_social BOOLEAN NOT NULL DEFAULT FALSE",
    );
  });
});

describeDb("brand automation migration against local Supabase", () => {
  let client: Client;
  const ids = {
    user: randomUUID(),
    company: randomUUID(),
    brand: randomUUID(),
  };

  beforeAll(async () => {
    expect(migrationFile).toBeDefined();
    assertLocalDatabase(databaseUrl!);

    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query("BEGIN");

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
      [ids.user, `brand-automation-${ids.user}@example.test`],
    );
    await client.query(
      `
        INSERT INTO public.companies (id, name, slug, owner_id)
        VALUES ($1, 'Brand Automation Company', $2, $3)
      `,
      [ids.company, `brand-automation-${ids.company}`, ids.user],
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
        VALUES ($1, $2, 'Existing Brand')
      `,
      [ids.brand, ids.company],
    );

    await client.query(migrationSql);
  });

  afterAll(async () => {
    if (!client) {
      return;
    }

    await client.query("ROLLBACK");
    await client.end();
  });

  it("defaults existing brands to automation level 1", async () => {
    const result = await client.query<{
      automation_level: number;
      auto_articles_per_week: number;
      auto_publish_to_social: boolean;
    }>(
      `
        SELECT automation_level, auto_articles_per_week, auto_publish_to_social
        FROM public.brands
        WHERE id = $1
      `,
      [ids.brand],
    );

    expect(result.rows[0]).toEqual({
      automation_level: 1,
      auto_articles_per_week: 0,
      auto_publish_to_social: false,
    });
  });

  it("rejects automation levels outside the allowed range", async () => {
    await expectCheckViolation(
      client,
      "UPDATE public.brands SET automation_level = 5 WHERE id = $1",
      [ids.brand],
    );
  });
});
