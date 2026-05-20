import { describe, expect, it, vi } from "vitest";
import { runAudit } from "../src/audit-cli";

describe("audit-cli", () => {
  const report = {
    id: "scan_1",
    url: "https://example.com",
    scannedAt: "2026-05-22T00:00:00.000Z",
    pagesScanned: 1,
    healthScore: 75,
    issues: [
      {
        ruleId: "meta.description.missing",
        severity: "critical" as const,
        riskLevel: "high" as const,
        page: "https://example.com",
        selector: 'meta[name="description"]',
        current: "Missing meta description",
        suggested: "Add a concise page description.",
        source: "html-scan" as const,
        estimatedImpact: "high" as const,
      },
    ],
  };

  it("throws a missing args error without --website-id or --url", async () => {
    await expect(
      runAudit([], {
        adminClient: {} as never,
        auditWebsiteFn: vi.fn(),
      }),
    ).rejects.toThrow("missing required argument: --website-id or --url");
  });

  it("audits a direct --url and persists the report plus issues", async () => {
    const auditWebsiteFn = vi.fn().mockResolvedValue(report);
    const reportSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "report_1" }, error: null });
    const reportSelect = vi.fn(() => ({ single: reportSingle }));
    const reportInsert = vi.fn(() => ({ select: reportSelect }));
    const issuesInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === "audit_reports") return { insert: reportInsert };
        if (table === "audit_issues") return { insert: issuesInsert };
        throw new Error(`unexpected table: ${table}`);
      }),
    };

    await runAudit(
      [
        "--company-id",
        "company_1",
        "--url",
        "https://example.com",
      ],
      {
        adminClient,
        auditWebsiteFn,
      },
    );

    expect(auditWebsiteFn).toHaveBeenCalledWith({
      url: "https://example.com",
      scope: "single-page",
    });
    expect(reportInsert).toHaveBeenCalledWith({
      company_id: "company_1",
      website_id: null,
      url: "https://example.com",
      scope: "single-page",
      health_score: 75,
      pages_scanned: 1,
      raw_payload: report,
      source: "cli",
      scanned_at: "2026-05-22T00:00:00.000Z",
      created_by: null,
    });
    expect(issuesInsert).toHaveBeenCalledWith([
      {
        report_id: "report_1",
        rule_id: "meta.description.missing",
        severity: "critical",
        risk_level: "high",
        page: "https://example.com",
        selector: 'meta[name="description"]',
        current: "Missing meta description",
        suggested: "Add a concise page description.",
        source: "html-scan",
        estimated_impact: "high",
      },
    ]);
  });

  it("looks up the website URL when --website-id is provided", async () => {
    const auditWebsiteFn = vi.fn().mockResolvedValue({
      ...report,
      url: "https://website.test",
      issues: [],
    });
    const websiteSingle = vi.fn().mockResolvedValue({
      data: {
        wordpress_url: "https://website.test",
        company_id: "company_from_website",
      },
      error: null,
    });
    const websiteEq = vi.fn(() => ({ single: websiteSingle }));
    const websiteSelect = vi.fn(() => ({ eq: websiteEq }));
    const reportSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: "report_2" }, error: null });
    const reportSelect = vi.fn(() => ({ single: reportSingle }));
    const reportInsert = vi.fn(() => ({ select: reportSelect }));
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === "website_configs") return { select: websiteSelect };
        if (table === "audit_reports") return { insert: reportInsert };
        if (table === "audit_issues") {
          throw new Error("issues should not be inserted when empty");
        }
        throw new Error(`unexpected table: ${table}`);
      }),
    };

    await runAudit(["--website-id", "website_1"], {
      adminClient,
      auditWebsiteFn,
    });

    expect(websiteSelect).toHaveBeenCalledWith("wordpress_url, company_id");
    expect(websiteEq).toHaveBeenCalledWith("id", "website_1");
    expect(auditWebsiteFn).toHaveBeenCalledWith({
      url: "https://website.test",
      scope: "single-page",
    });
    expect(reportInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company_from_website",
        website_id: "website_1",
        url: "https://website.test",
      }),
    );
  });
});
