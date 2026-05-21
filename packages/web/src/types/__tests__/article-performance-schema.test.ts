import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database, Tables } from "../database.types";

const repoRoot = process.cwd().endsWith("packages/web")
  ? join(process.cwd(), "../..")
  : process.cwd();

const migrationsDir = join(repoRoot, "supabase/migrations");

function readArticlePerformanceMigration() {
  const migrationFile = readdirSync(migrationsDir).find((file) =>
    file.endsWith("_article_performance.sql"),
  );

  expect(migrationFile).toBeDefined();

  return readFileSync(join(migrationsDir, migrationFile!), "utf8");
}

describe("article_performance schema", () => {
  it("creates the table, primary key, indexes, and RLS policies", () => {
    const sql = readArticlePerformanceMigration();

    expect(sql).toContain("CREATE TABLE public.article_performance");
    expect(sql).toContain("REFERENCES public.generated_articles(id)");
    expect(sql).toContain("ON DELETE CASCADE");
    expect(sql).toContain(
      "CHECK (source IN ('ga4','gsc','wordpress','social'))",
    );
    expect(sql).toContain("PRIMARY KEY (article_id, date, source)");
    expect(sql).toContain("CREATE INDEX idx_article_perf_date");
    expect(sql).toContain("CREATE INDEX idx_article_perf_top");
    expect(sql).toContain(
      "ALTER TABLE public.article_performance ENABLE ROW LEVEL SECURITY",
    );

    for (const policy of [
      "article_performance_company_select",
      "article_performance_company_insert",
      "article_performance_company_update",
      "article_performance_company_delete",
    ]) {
      expect(sql).toContain(`CREATE POLICY ${policy}`);
    }

    expect(sql).toContain("FROM public.generated_articles ga");
    expect(sql).toContain("JOIN public.company_members cm");
    expect(sql).toContain("ga.id = article_performance.article_id");
    expect(sql).toContain("cm.status = 'active'");
  });

  it("exposes generated Database types for rows, inserts, and updates", () => {
    expectTypeOf<Tables<"article_performance">>().toMatchTypeOf<{
      article_id: string;
      date: string;
      source: "ga4" | "gsc" | "wordpress" | "social";
      pageviews: number;
      unique_visitors: number;
      avg_session_seconds: number | null;
      conversions: number;
      ctr: number | null;
      position: number | null;
      raw_metadata: Database["public"]["Tables"]["article_performance"]["Row"]["raw_metadata"];
      created_at: string;
    }>();

    expectTypeOf<
      Database["public"]["Tables"]["article_performance"]["Insert"]
    >().toMatchTypeOf<{
      article_id: string;
      date: string;
      source: "ga4" | "gsc" | "wordpress" | "social";
      pageviews?: number;
      unique_visitors?: number;
      avg_session_seconds?: number | null;
      conversions?: number;
      ctr?: number | null;
      position?: number | null;
      raw_metadata?: Database["public"]["Tables"]["article_performance"]["Row"]["raw_metadata"];
      created_at?: string;
    }>();
  });
});
