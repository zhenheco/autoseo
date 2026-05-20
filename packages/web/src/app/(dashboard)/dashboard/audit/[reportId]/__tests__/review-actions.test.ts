import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserCompanies: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

const auditMocks = vi.hoisted(() => ({
  applyAuditFixToShopline: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("@audit", () => auditMocks);

type TableName =
  | "audit_issues"
  | "audit_reports"
  | "website_configs"
  | "shopline_connections"
  | "audit_fix_log";

function createSupabaseMock(rows: Partial<Record<TableName, unknown[]>>) {
  const calls: Array<{ table: TableName; method: string; args: unknown[] }> =
    [];

  return {
    calls,
    from(table: TableName) {
      const builder = {
        filters: [] as Array<[string, unknown]>,
        select: vi.fn((...args: unknown[]) => {
          calls.push({ table, method: "select", args });
          return builder;
        }),
        eq: vi.fn((column: string, value: unknown) => {
          calls.push({ table, method: "eq", args: [column, value] });
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
        insert: vi.fn(async (payload: unknown) => {
          calls.push({ table, method: "insert", args: [payload] });
          return { data: null, error: null };
        }),
        update: vi.fn((payload: unknown) => {
          calls.push({ table, method: "update", args: [payload] });
          return builder;
        }),
        then(
          resolve: (value: { data: null; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({ data: null, error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return builder;
    },
  };
}

function createRows(
  overrides: {
    issue?: Record<string, unknown>;
    report?: Record<string, unknown>;
    website?: Record<string, unknown>;
    connection?: Record<string, unknown> | null;
  } = {},
): Partial<Record<TableName, unknown[]>> {
  return {
    audit_issues: [
      {
        id: "issue-1",
        report_id: "report-1",
        rule_id: "meta.description.tooShort",
        severity: "warning",
        risk_level: "medium",
        page: "https://demo-shop.myshopline.com/products/blue-shirt",
        selector: 'meta[name="description"]',
        current: "Short",
        suggested: "A polished SHOPLINE meta description.",
        source: "html-scan",
        estimated_impact: "medium",
        status: "pending-review",
        ...overrides.issue,
      },
    ],
    audit_reports: [
      {
        id: "report-1",
        company_id: "company-1",
        website_id: "website-1",
        url: "https://demo-shop.myshopline.com",
        ...overrides.report,
      },
    ],
    website_configs: [
      {
        id: "website-1",
        company_id: "company-1",
        wordpress_url: "https://demo-shop.myshopline.com",
        ...overrides.website,
      },
    ],
    shopline_connections:
      overrides.connection === null
        ? []
        : [
            {
              id: "connection-1",
              company_id: "company-1",
              website_id: "website-1",
              shop_handle: "demo-shop",
              shop_domain: "demo-shop.myshopline.com",
              status: "active",
              ...overrides.connection,
            },
          ],
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
      createSupabaseMock(createRows()),
    );
    auditMocks.applyAuditFixToShopline.mockResolvedValue({
      ok: true,
      route: "shopline-editor",
      before: "Short",
      after: "A polished SHOPLINE meta description.",
    });
  });

  it("approveAuditIssue returns unauthorized when the user is not authenticated", async () => {
    authMocks.getUser.mockResolvedValueOnce(null);
    const { approveAuditIssue } = await import("../review-actions");

    const result = await approveAuditIssue(formData({ issueId: "issue-1" }));

    expect(result).toEqual({ ok: false, error: "unauthorized" });
  });

  it("approveAuditIssue returns forbidden when the issue report belongs to another company", async () => {
    supabaseMocks.createClient.mockResolvedValueOnce(
      createSupabaseMock(createRows({ report: { company_id: "company-2" } })),
    );
    const { approveAuditIssue } = await import("../review-actions");

    const result = await approveAuditIssue(formData({ issueId: "issue-1" }));

    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("approveAuditIssue applies a medium-risk SHOPLINE issue and marks it auto-applied", async () => {
    const supabase = createSupabaseMock(createRows());
    supabaseMocks.createClient.mockResolvedValueOnce(supabase);
    const { approveAuditIssue } = await import("../review-actions");

    const result = await approveAuditIssue(formData({ issueId: "issue-1" }));

    expect(result).toEqual({
      ok: true,
      route: "shopline-editor",
      before: "Short",
      after: "A polished SHOPLINE meta description.",
    });
    expect(auditMocks.applyAuditFixToShopline).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: "report-1",
        shopHandle: "demo-shop",
      }),
      expect.objectContaining({
        shoplineUpdate: expect.any(Function),
        generateMetaDescription: expect.any(Function),
        generateImageAlt: expect.any(Function),
        getShopHandleForReport: expect.any(Function),
      }),
    );
    expect(supabase.calls).toContainEqual({
      table: "audit_fix_log",
      method: "insert",
      args: [
        {
          issue_id: "issue-1",
          applied_by: "user-1",
          route: "shopline-editor",
          before: "Short",
          after: "A polished SHOPLINE meta description.",
          result: "success",
          error_message: null,
        },
      ],
    });
    expect(supabase.calls).toContainEqual({
      table: "audit_issues",
      method: "update",
      args: [{ status: "auto-applied" }],
    });
  });
});
