import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserCompanies: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);

type TableName = "audit_issues" | "audit_reports";

function createSupabaseMock(rows: Partial<Record<TableName, unknown[]>>) {
  return {
    from(table: TableName) {
      const builder = {
        filters: [] as Array<[string, unknown]>,
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: unknown) => {
          builder.filters.push([column, value]);
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          const data = (rows[table] ?? []).find((row) =>
            builder.filters.every(
              ([column, value]) =>
                (row as Record<string, unknown>)[column] === value,
            ),
          );
          return { data: data ?? null, error: null };
        }),
      };
      return builder;
    },
  };
}

function formData(entries: Record<string, string | string[]> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const item of value) data.append(key, item);
    } else {
      data.set(key, value);
    }
  }
  return data;
}

describe("audit review actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authMocks.getUser.mockResolvedValue({ id: "user-1" });
    authMocks.getUserCompanies.mockResolvedValue([
      { companies: { id: "company-1" }, role: "owner", status: "active" },
    ]);
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({
        audit_issues: [
          {
            id: "issue-1",
            report_id: "report-1",
            risk_level: "medium",
            status: "pending-review",
          },
        ],
        audit_reports: [
          { id: "report-1", company_id: "company-1", website_id: "website-1" },
        ],
      }),
    );
  });

  it("approveAuditIssue returns unauthorized when the user is not authenticated", async () => {
    authMocks.getUser.mockResolvedValueOnce(null);
    const { approveAuditIssue } = await import("../review-actions");

    const result = await approveAuditIssue(formData({ issueId: "issue-1" }));

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("approveAuditIssue returns forbidden when the issue report belongs to another company", async () => {
    supabaseMocks.createClient.mockResolvedValueOnce(
      createSupabaseMock({
        audit_issues: [
          {
            id: "issue-1",
            report_id: "report-1",
            risk_level: "medium",
            status: "pending-review",
          },
        ],
        audit_reports: [
          { id: "report-1", company_id: "company-2", website_id: "website-1" },
        ],
      }),
    );
    const { approveAuditIssue } = await import("../review-actions");

    const result = await approveAuditIssue(formData({ issueId: "issue-1" }));

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });
});
