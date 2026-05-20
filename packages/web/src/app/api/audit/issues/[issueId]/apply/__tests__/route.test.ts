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
});
