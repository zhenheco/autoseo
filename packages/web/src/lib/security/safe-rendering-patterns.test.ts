import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

describe("security rendering patterns", () => {
  it("uses script-safe JSON-LD serialization at structured-data sinks", () => {
    const files = [
      "src/components/seo/SchemaMarkup.tsx",
      "src/components/blog/ArticleSchema.tsx",
      "src/components/blog/BreadcrumbSchema.tsx",
      "src/app/faq/page.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).toContain("serializeJsonLd");
      expect(source).not.toMatch(
        /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/,
      );
    }
  });

  it("sanitizes generated article HTML before rendering", () => {
    const dashboardArticle = read(
      "src/app/(dashboard)/dashboard/articles/[id]/page.tsx",
    );
    const generatorExample = read("src/components/ArticleGeneratorExample.tsx");

    expect(dashboardArticle).toMatch(
      /__html:\s*sanitizeArticleHtml\(\s*generatedArticle\.html_content/,
    );
    expect(generatorExample).toMatch(
      /__html:\s*sanitizeArticleHtml\(\s*article\.content/,
    );
  });

  it("keeps migration TLS verification enabled by default", () => {
    const source = read("scripts/run-migrations.js");

    expect(source).not.toMatch(/rejectUnauthorized:\s*false/);
    expect(source).toContain("SUPABASE_DB_SSL_REJECT_UNAUTHORIZED");
  });
});
