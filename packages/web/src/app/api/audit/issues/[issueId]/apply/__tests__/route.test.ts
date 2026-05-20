import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthMode = "authorized" | "unauthorized";
type TableName =
  | "audit_issues"
  | "audit_reports"
  | "website_configs"
  | "shopline_connections"
  | "audit_fix_log";

const authState = vi.hoisted(() => ({
  mode: "authorized" as AuthMode,
  supabase: null as unknown,
}));

const auditMocks = vi.hoisted(() => ({
  applyAuditFixToShopline: vi.fn(),
  applyAuditFixToEdgeWorker: vi.fn(),
  createCloudflareKvDeps: vi.fn(() => ({
    kvGet: vi.fn(),
    kvPut: vi.fn(),
  })),
}));

vi.mock("@/lib/api/auth-middleware", () => ({
  withCompany: vi.fn(
    (handler) =>
      async (request: Request, ...args: unknown[]) => {
        if (authState.mode === "unauthorized") {
          return Response.json(
            { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
            { status: 401 },
          );
        }

        return handler(
          request,
          {
            user: { id: "user-1" },
            companyId: "company-1",
            supabase: authState.supabase,
          },
          ...args,
        );
      },
  ),
}));
vi.mock("@audit", () => auditMocks);

function params(issueId = "issue-1") {
  return {
    params: Promise.resolve({ issueId }),
  };
}

function createSupabaseMock(
  rows: Partial<Record<TableName, Array<Record<string, unknown>>>>,
) {
  const calls: Array<{ table: TableName; method: string; args: unknown[] }> =
    [];

  return {
    calls,
    from(table: TableName) {
      const builder = {
        filters: [] as Array<[string, unknown]>,
        updatePayload: undefined as unknown,
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
          calls.push({ table, method: "maybeSingle", args: [] });
          const data = (rows[table] ?? []).find((row) =>
            builder.filters.every(([column, value]) => row[column] === value),
          );
          return { data: data ?? null, error: null };
        }),
        insert: vi.fn(async (payload: unknown) => {
          calls.push({ table, method: "insert", args: [payload] });
          return { data: null, error: null };
        }),
        update: vi.fn((payload: unknown) => {
          calls.push({ table, method: "update", args: [payload] });
          builder.updatePayload = payload;
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

function rowsForEligibleIssue(
  overrides: {
    issue?: Record<string, unknown>;
    report?: Record<string, unknown>;
    website?: Record<string, unknown>;
    connection?: Record<string, unknown> | null;
  } = {},
) {
  return {
    audit_issues: [
      {
        id: "issue-1",
        report_id: "report-1",
        rule_id: "meta.description.tooShort",
        severity: "warning",
        risk_level: "low",
        page: "https://demo-shop.myshopline.com/products/blue-shirt",
        selector: 'meta[name="description"]',
        current: "Short",
        suggested: null,
        source: "html-scan",
        estimated_impact: "medium",
        status: "open",
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

async function post(issueId = "issue-1") {
  const { POST } = await import("../route");
  return POST(
    new Request(`https://1wayseo.com/api/audit/issues/${issueId}/apply`, {
      method: "POST",
    }) as never,
    params(issueId),
  );
}

describe("POST /api/audit/issues/[issueId]/apply", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authState.mode = "authorized";
    authState.supabase = createSupabaseMock({});
    auditMocks.applyAuditFixToShopline.mockResolvedValue({
      ok: true,
      route: "shopline-editor",
      before: "Short",
      after: "A polished SHOPLINE meta description.",
    });
    auditMocks.applyAuditFixToEdgeWorker.mockResolvedValue({
      ok: true,
      route: "edge-worker",
      before: "Short",
      after: JSON.stringify([
        {
          type: "meta-description",
          value: "Edge-rendered product description.",
        },
      ]),
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.mode = "unauthorized";

    const response = await post();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
    });
  });

  it("returns 403 when the issue report belongs to another company", async () => {
    authState.supabase = createSupabaseMock({
      audit_issues: [
        {
          id: "issue-1",
          report_id: "report-1",
          risk_level: "low",
        },
      ],
      audit_reports: [
        {
          id: "report-1",
          company_id: "company-2",
          website_id: "website-1",
        },
      ],
    });

    const response = await post();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "forbidden",
    });
  });

  it("returns 400 not_eligible when the issue risk level is not low", async () => {
    authState.supabase = createSupabaseMock(
      rowsForEligibleIssue({ issue: { risk_level: "medium" } }),
    );

    const response = await post();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "not_eligible",
    });
  });

  it("returns 400 route_not_available when the issue target is not SHOPLINE", async () => {
    authState.supabase = createSupabaseMock(
      rowsForEligibleIssue({
        issue: { rule_id: "alt.missing" },
        website: { wordpress_url: "https://example.com" },
        connection: null,
      }),
    );

    const response = await post();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "route_not_available",
    });
  });

  it("routes a non-SHOPLINE company website issue through edge-worker and logs it", async () => {
    const supabase = createSupabaseMock(
      rowsForEligibleIssue({
        issue: {
          page: "https://example.com/products/blue-shirt",
          suggested: "Edge-rendered product description.",
        },
        report: { url: "https://example.com" },
        website: { wordpress_url: "https://example.com" },
        connection: null,
      }),
    );
    authState.supabase = supabase;

    const response = await post();

    expect(response.status).toBe(200);
    expect(auditMocks.applyAuditFixToShopline).not.toHaveBeenCalled();
    expect(auditMocks.applyAuditFixToEdgeWorker).toHaveBeenCalledWith(
      {
        issue: expect.objectContaining({
          ruleId: "meta.description.tooShort",
          page: "https://example.com/products/blue-shirt",
          suggested: "Edge-rendered product description.",
        }),
        shopDomain: "example.com",
        path: "/products/blue-shirt",
      },
      expect.objectContaining({
        kvGet: expect.any(Function),
        kvPut: expect.any(Function),
      }),
    );
    expect(supabase.calls).toContainEqual({
      table: "audit_fix_log",
      method: "insert",
      args: [
        {
          issue_id: "issue-1",
          applied_by: "user-1",
          route: "edge-worker",
          before: "Short",
          after: JSON.stringify([
            {
              type: "meta-description",
              value: "Edge-rendered product description.",
            },
          ]),
          result: "success",
          error_message: null,
        },
      ],
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      route: "edge-worker",
      before: "Short",
      after: JSON.stringify([
        {
          type: "meta-description",
          value: "Edge-rendered product description.",
        },
      ]),
    });
  });

  it("returns 200, writes audit_fix_log, and marks the issue auto-applied when the fix succeeds", async () => {
    const supabase = createSupabaseMock(rowsForEligibleIssue());
    authState.supabase = supabase;

    const response = await post();

    expect(response.status).toBe(200);
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
    await expect(response.json()).resolves.toEqual({
      ok: true,
      route: "shopline-editor",
      before: "Short",
      after: "A polished SHOPLINE meta description.",
    });
  });

  it("returns 200, writes a failed audit_fix_log, and keeps the issue open when the fix fails", async () => {
    auditMocks.applyAuditFixToShopline.mockResolvedValueOnce({
      ok: false,
      route: "shopline-editor",
      before: "Short",
      after: "",
      error: "shopline_rate_limited",
    });
    const supabase = createSupabaseMock(rowsForEligibleIssue());
    authState.supabase = supabase;

    const response = await post();

    expect(response.status).toBe(200);
    expect(supabase.calls).toContainEqual({
      table: "audit_fix_log",
      method: "insert",
      args: [
        {
          issue_id: "issue-1",
          applied_by: "user-1",
          route: "shopline-editor",
          before: "Short",
          after: "",
          result: "failed",
          error_message: "shopline_rate_limited",
        },
      ],
    });
    expect(supabase.calls).not.toContainEqual({
      table: "audit_issues",
      method: "update",
      args: [{ status: "auto-applied" }],
    });
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "shopline_rate_limited",
    });
  });
});
