import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName = "website_configs" | "audit_reports" | "audit_issues";

const authState = vi.hoisted(() => ({
  mode: "authorized" as "authorized" | "unauthorized",
  supabase: null as unknown,
}));

const auditMocks = vi.hoisted(() => ({
  auditWebsite: vi.fn(),
}));

vi.mock("@audit", () => auditMocks);
vi.mock("@/lib/api/auth-middleware", () => ({
  withCompany: vi.fn((handler) => async (request: Request) => {
    if (authState.mode === "unauthorized") {
      return Response.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 },
      );
    }

    return handler(request, {
      user: { id: "user-1" },
      companyId: "company-1",
      supabase: authState.supabase,
    });
  }),
}));

function createSupabaseMock(options: {
  website?: Record<string, unknown> | null;
  reportId?: string;
}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  const client = {
    calls,
    from(table: TableName) {
      const builder = {
        insertPayload: undefined as unknown,
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        insert(payload: unknown) {
          calls.push({ table, method: "insert", args: [payload] });
          builder.insertPayload = payload;
          if (table === "audit_issues") {
            return Promise.resolve({ data: null, error: null });
          }
          return builder;
        },
        maybeSingle: vi.fn(async () => ({
          data: options.website ?? null,
          error: null,
        })),
        single: vi.fn(async () => ({
          data: { id: options.reportId ?? "report-1" },
          error: null,
        })),
      };
      return builder;
    },
  };

  return client;
}

async function post(body?: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://example.com/api/audit", {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    }) as never,
  );
}

describe("audit API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    authState.mode = "authorized";
    authState.supabase = createSupabaseMock({
      website: {
        id: "website-1",
        company_id: "company-1",
        wordpress_url: "https://example.com",
      },
    });
    auditMocks.auditWebsite.mockResolvedValue({
      id: "audit-run-1",
      url: "https://example.com",
      scannedAt: "2026-05-20T10:00:00.000Z",
      pagesScanned: 1,
      healthScore: 88,
      issues: [
        {
          ruleId: "missing-title",
          severity: "critical",
          riskLevel: "high",
          page: "https://example.com",
          selector: "title",
          current: "Missing",
          suggested: "Add title",
          source: "html-scan",
          estimatedImpact: "high",
        },
      ],
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.mode = "unauthorized";

    const response = await post({
      websiteId: "website-1",
      scope: "single-page",
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 when websiteId and url are missing", async () => {
    const response = await post({ scope: "single-page" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "websiteId or url is required",
    });
  });

  it("returns 403 when the website does not belong to the company", async () => {
    authState.supabase = createSupabaseMock({
      website: {
        id: "website-2",
        company_id: "company-2",
        wordpress_url: "https://other.example.com",
      },
    });

    const response = await post({
      websiteId: "website-2",
      scope: "single-page",
    });

    expect(response.status).toBe(403);
  });

  it("audits the website, inserts report and issues, and returns report redirect", async () => {
    const supabase = createSupabaseMock({
      website: {
        id: "website-1",
        company_id: "company-1",
        wordpress_url: "https://example.com",
      },
      reportId: "report-99",
    });
    authState.supabase = supabase;

    const response = await post({
      websiteId: "website-1",
      scope: "single-page",
    });

    expect(response.status).toBe(200);
    expect(auditMocks.auditWebsite).toHaveBeenCalledWith({
      url: "https://example.com",
      scope: "single-page",
    });
    expect(supabase.calls).toContainEqual(
      expect.objectContaining({ table: "audit_reports", method: "insert" }),
    );
    expect(supabase.calls).toContainEqual(
      expect.objectContaining({ table: "audit_issues", method: "insert" }),
    );
    await expect(response.json()).resolves.toEqual({
      reportId: "report-99",
      redirect: "/dashboard/audit/report-99",
    });
  });
});
