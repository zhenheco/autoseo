import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthMode = "authorized" | "unauthorized";
type TableName = "audit_issues" | "audit_reports" | "article_jobs";

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

const issueId = "11111111-1111-4111-8111-111111111111";

function params(id = issueId) {
  return {
    params: Promise.resolve({ issueId: id }),
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
        insertPayload: undefined as unknown,
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
        insert: vi.fn((payload: unknown) => {
          calls.push({ table, method: "insert", args: [payload] });
          builder.insertPayload = payload;
          return builder;
        }),
        single: vi.fn(async () => {
          calls.push({ table, method: "single", args: [] });
          if (table === "article_jobs" && builder.insertPayload) {
            return { data: { id: "job-1" }, error: null };
          }

          return { data: null, error: null };
        }),
      };
      return builder;
    },
  };
}

function rowsForDispatch(
  overrides: {
    issue?: Record<string, unknown>;
    report?: Record<string, unknown>;
    articleJobs?: Array<Record<string, unknown>>;
  } = {},
) {
  return {
    audit_issues: [
      {
        id: issueId,
        report_id: "report-1",
        rule_id: "content.missing-topic",
        severity: "info",
        risk_level: "medium",
        page: "https://example.com/products",
        selector: 'meta[name="keywords"]',
        current: "ergonomic desk",
        suggested: "/blog/ergonomic-desk",
        source: "html-scan",
        estimated_impact: "high",
        ...overrides.issue,
      },
    ],
    audit_reports: [
      {
        id: "report-1",
        company_id: "company-1",
        ...overrides.report,
      },
    ],
    article_jobs: overrides.articleJobs ?? [],
  };
}

async function post(id = issueId) {
  const { POST } = await import("../route");
  return POST(
    new Request(`https://1wayseo.com/api/audit/issues/${id}/dispatch-article`, {
      method: "POST",
    }) as never,
    params(id),
  );
}

describe("POST /api/audit/issues/[issueId]/dispatch-article", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authState.mode = "authorized";
    authState.supabase = createSupabaseMock(rowsForDispatch());
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.mode = "unauthorized";

    const response = await post();

    expect(response.status).toBe(401);
  });

  it("returns 403 when the issue report belongs to another company", async () => {
    authState.supabase = createSupabaseMock(
      rowsForDispatch({ report: { company_id: "company-2" } }),
    );

    const response = await post();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "forbidden",
    });
  });

  it("returns 200 with a jobId when dispatch succeeds", async () => {
    const supabase = createSupabaseMock(rowsForDispatch());
    authState.supabase = supabase;

    const response = await post();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      jobId: "job-1",
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "insert",
      args: [
        expect.objectContaining({
          company_id: "company-1",
          audit_issue_id: issueId,
          source_type: "audit-driven",
          keywords: ["ergonomic desk"],
          status: "pending",
        }),
      ],
    });
  });
});
