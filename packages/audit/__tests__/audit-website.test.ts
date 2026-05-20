import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
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

  it("includes chromium audit results when includeChromium is enabled", async () => {
    const html = readFixture("all-good.html");
    const fetchOk: typeof fetch = async () =>
      new Response(html, { status: 200 });

    const report = await auditWebsite(
      {
        url: "https://example.com",
        scope: "single-page",
        includeChromium: true,
      },
      {
        fetch: fetchOk,
        now: () => new Date("2026-05-21T02:00:00.000Z"),
        randomUuid: () => "audit-id-chromium",
        chromiumAudit: async () => ({
          cwv: {
            lcp: 2100,
            fid: 40,
            cls: 0.04,
            inp: 90,
          },
          a11yIssues: [
            {
              ruleId: "axe.color-contrast",
              severity: "warning",
              riskLevel: "medium",
              page: "https://example.com",
              selector: ".cta",
              current: "Element has insufficient color contrast",
              suggested: "Increase foreground/background contrast",
              source: "a11y",
              estimatedImpact: "medium",
            },
          ],
        }),
      },
    );

    expect(report.cwv).toEqual({
      lcp: 2100,
      fid: 40,
      cls: 0.04,
      inp: 90,
    });
    expect(report.issues).toEqual([
      {
        ruleId: "axe.color-contrast",
        severity: "warning",
        riskLevel: "medium",
        page: "https://example.com",
        selector: ".cta",
        current: "Element has insufficient color contrast",
        suggested: "Increase foreground/background contrast",
        source: "a11y",
        estimatedImpact: "medium",
      },
    ]);
  });

  it("degrades to HTML scan results when chromium audit fails", async () => {
    const html = readFixture("short-meta-desc.html");
    const fetchOk: typeof fetch = async () =>
      new Response(html, { status: 200 });

    const report = await auditWebsite(
      {
        url: "https://example.com/short-meta",
        scope: "single-page",
        includeChromium: true,
      },
      {
        fetch: fetchOk,
        chromiumAudit: async () => {
          throw new Error("chromium_binding_not_available");
        },
      },
    );

    expect(report.cwv).toBeUndefined();
    expect(report.issues).toEqual([
      expect.objectContaining({
        ruleId: "meta.description.tooShort",
        source: "html-scan",
      }),
      {
        ruleId: "chromium.audit.unavailable",
        severity: "warning",
        riskLevel: "low",
        page: "https://example.com/short-meta",
        current: "Chromium audit unavailable: chromium_binding_not_available",
        suggested:
          "Enable Cloudflare Browser Rendering binding before relying on CWV and axe-core results.",
        source: "security",
        estimatedImpact: "low",
      },
    ]);
  });

  it("does not call chromium audit when includeChromium is false", async () => {
    const html = readFixture("all-good.html");
    const fetchOk: typeof fetch = async () =>
      new Response(html, { status: 200 });
    const chromiumAudit = vi.fn(async () => ({
      cwv: {
        lcp: 2100,
        fid: 40,
        cls: 0.04,
        inp: 90,
      },
      a11yIssues: [],
    }));

    await auditWebsite(
      {
        url: "https://example.com",
        scope: "single-page",
        includeChromium: false,
      },
      {
        fetch: fetchOk,
        chromiumAudit,
      },
    );

    expect(chromiumAudit).not.toHaveBeenCalled();
  });
});
