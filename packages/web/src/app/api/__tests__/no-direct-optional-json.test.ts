import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("optional JSON route parsing", () => {
  it.each([
    "src/app/api/sitemap/revalidate/route.ts",
    "src/app/api/sitemap/ping/route.ts",
  ])("%s uses the shared JSON parser", (path) => {
    const source = readFileSync(join(repoRoot, path), "utf8");

    expect(source).not.toContain("request.json()");
    expect(source).toContain("safeJson");
  });
});
