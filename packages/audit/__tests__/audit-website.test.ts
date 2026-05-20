import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { scoreHealth } from "../src/index";
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

    expect(report.healthScore).toBe(scoreHealth(report.issues));
    expect(report).toEqual({
      id: "audit-id-1",
      url: "https://example.com/short-meta",
      scannedAt: "2026-05-21T01:00:00.000Z",
      pagesScanned: 1,
      healthScore: scoreHealth(report.issues),
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

  it("throws audit_fetch_failed when fetch rejects", async () => {
    const fetchRejects: typeof fetch = async () => {
      throw new Error("network down");
    };

    await expect(
      auditWebsite(
        {
          url: "https://example.com/down",
          scope: "single-page",
        },
        { fetch: fetchRejects },
      ),
    ).rejects.toThrow("audit_fetch_failed");
  });

  it("throws audit_fetch_failed with status when response is not ok", async () => {
    const fetchServerError: typeof fetch = async () =>
      new Response("server error", { status: 500 });

    await expect(
      auditWebsite(
        {
          url: "https://example.com/server-error",
          scope: "single-page",
        },
        { fetch: fetchServerError },
      ),
    ).rejects.toThrow("audit_fetch_failed: HTTP 500");
  });

  it("throws scope_not_implemented for sitemap scope", async () => {
    const fetchOk: typeof fetch = async () => new Response("<html></html>");

    await expect(
      auditWebsite(
        {
          url: "https://example.com/sitemap.xml",
          scope: "sitemap",
        },
        { fetch: fetchOk },
      ),
    ).rejects.toThrow("scope_not_implemented: sitemap");
  });
});
