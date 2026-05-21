import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Tables } from "../database.types";

const repoRoot = process.cwd().endsWith("packages/web")
  ? join(process.cwd(), "../..")
  : process.cwd();

const migrationsDir = join(repoRoot, "supabase/migrations");

function readArticleAssetsMigration() {
  const migrationFile = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_create_article_assets.sql"),
  );

  expect(migrationFile).toBeDefined();

  return readFileSync(join(migrationsDir, migrationFile!), "utf8");
}

describe("article_assets schema", () => {
  it("creates the card asset table with indexes and four RLS policies", () => {
    const sql = readArticleAssetsMigration();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.article_assets");
    expect(sql).toContain("REFERENCES public.generated_articles(id)");
    expect(sql).toContain("kind TEXT NOT NULL CHECK");
    expect(sql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_article_assets_article",
    );
    expect(sql).toContain(
      "ALTER TABLE public.article_assets ENABLE ROW LEVEL SECURITY",
    );

    for (const policy of [
      "article_assets_company_select",
      "article_assets_company_insert",
      "article_assets_company_update",
      "article_assets_company_delete",
    ]) {
      expect(sql).toContain(`CREATE POLICY ${policy}`);
    }

    expect(sql).toContain("FROM public.generated_articles ga");
    expect(sql).toContain("JOIN public.company_members cm");
    expect(sql).toContain("cm.status = 'active'");
  });

  it("exposes generated Database types for rows, inserts, and updates", () => {
    expectTypeOf<Tables<"article_assets">>().toMatchTypeOf<{
      id: string;
      article_id: string;
      kind: "card" | "image" | "video";
      template: string | null;
      size: string | null;
      r2_url: string;
      brand_id: string | null;
      created_at: string;
    }>();
  });
});
