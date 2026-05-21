import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database, Tables } from "../database.types";

const repoRoot = process.cwd().endsWith("packages/web")
  ? join(process.cwd(), "../..")
  : process.cwd();

const migrationsDir = join(repoRoot, "supabase/migrations");

function readBrandLayerMigration() {
  const migrationFile = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_create_brand_layer.sql"),
  );

  expect(migrationFile).toBeDefined();

  return readFileSync(join(migrationsDir, migrationFile!), "utf8");
}

describe("brand layer schema migration", () => {
  it("creates brand tables and all company-scoped RLS policies", () => {
    const sql = readBrandLayerMigration();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.brands");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.brand_keywords");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS public.brand_performance_memory",
    );

    for (const table of [
      "brands",
      "brand_keywords",
      "brand_performance_memory",
    ]) {
      expect(sql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
      );
      expect(sql).toContain(`brand_layer_${table}_select`);
      expect(sql).toContain(`brand_layer_${table}_insert`);
      expect(sql).toContain(`brand_layer_${table}_update`);
      expect(sql).toContain(`brand_layer_${table}_delete`);
    }

    expect(sql).toContain("public.company_members");
    expect(sql).toContain("company_members.status = 'active'");
  });

  it("backfills before dropping website_configs.brand_voice", () => {
    const sql = readBrandLayerMigration();

    expect(sql).toContain("INSERT INTO public.brands");
    expect(sql).toContain("ALTER TABLE public.website_configs");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS brand_id");
    expect(sql).toContain("ALTER TABLE public.generated_articles");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS brand_id");
    expect(sql).toContain(
      "website_type IN ('wordpress', 'platform_blog', 'external', 'shopline')",
    );

    const brandVoiceUpdateIndex = sql.indexOf("brand_voice_rows AS");
    const dropColumnIndex = sql.indexOf("DROP COLUMN IF EXISTS brand_voice");

    expect(brandVoiceUpdateIndex).toBeGreaterThan(-1);
    expect(dropColumnIndex).toBeGreaterThan(brandVoiceUpdateIndex);
    expect(sql).toContain("RAISE EXCEPTION");
    expect(sql).toContain("RAISE NOTICE");
  });

  it("exposes brand layer and backfilled columns in generated Database types", () => {
    expectTypeOf<Tables<"brands">>().toMatchTypeOf<{
      id: string;
      company_id: string;
      name: string;
      voice_tone: string | null;
      target_audience: Database["public"]["Tables"]["brands"]["Row"]["target_audience"];
      value_props: string[] | null;
      is_default: boolean;
      automation_level: number;
      auto_articles_per_week: number;
      auto_publish_to_social: boolean;
    }>();

    expectTypeOf<Tables<"brand_keywords">>().toMatchTypeOf<{
      brand_id: string;
      keyword: string;
      priority: number;
      created_at: string;
    }>();

    expectTypeOf<Tables<"brand_performance_memory">>().toMatchTypeOf<{
      brand_id: string;
      metric_key: string;
      metric_value: Database["public"]["Tables"]["brand_performance_memory"]["Row"]["metric_value"];
      updated_at: string;
    }>();

    expectTypeOf<Tables<"website_configs">["brand_id"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<Tables<"generated_articles">["brand_id"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<Tables<"website_configs">["website_type"]>().toEqualTypeOf<
      "wordpress" | "platform_blog" | "external" | "shopline" | null
    >();
  });
});
