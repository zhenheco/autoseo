import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditWebsite } from "../src/audit-website";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(testDir, "../fixtures");

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

describe("auditWebsite", () => {
  it("returns an audit report for a fetchable single page URL", async () => {
    const html = readFixture("short-meta-desc.html");
    const fetchOk: typeof fetch = async () =>
      new Response(html, { status: 200 });

    const report = await auditWebsite(
      {
        url: "https://example.com/short-meta",
        scope: "single-page",
      },
      {
        fetch: fetchOk,
        now: () => new Date("2026-05-21T01:00:00.000Z"),
        randomUuid: () => "audit-id-1",
      },
    );

    expect(report).toEqual({
      id: "audit-id-1",
      url: "https://example.com/short-meta",
      scannedAt: "2026-05-21T01:00:00.000Z",
      pagesScanned: 1,
      healthScore: 100,
      issues: [
        {
          ruleId: "meta.description.tooShort",
          severity: "warning",
          riskLevel: "low",
          page: "https://example.com/short-meta",
          selector: 'meta[name="description"]',
          current: "too short",
          source: "html-scan",
          estimatedImpact: "medium",
        },
      ],
    });
  });
});
