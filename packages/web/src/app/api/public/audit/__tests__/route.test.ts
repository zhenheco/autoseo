import { beforeEach, describe, expect, it, vi } from "vitest";

const auditMocks = vi.hoisted(() => ({
  auditWebsite: vi.fn(),
}));

const supabaseMocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@audit", () => auditMocks);
vi.mock("@shared/supabase", () => supabaseMocks);

type TableName = "audit_lead_inquiries" | "audit_reports";

function createSupabaseMock(
  options: {
    rateCount?: number;
    cachedReport?: Record<string, unknown> | null;
    reportId?: string;
  } = {},
) {
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
        gte(...args: unknown[]) {
          calls.push({ table, method: "gte", args });
          return builder;
        },
        gt(...args: unknown[]) {
          calls.push({ table, method: "gt", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
          return builder;
        },
        maybeSingle: vi.fn(async () => ({
          data: options.cachedReport ?? null,
          error: null,
        })),
        insert(payload: unknown) {
          calls.push({ table, method: "insert", args: [payload] });
          builder.insertPayload = payload;
          return builder;
        },
        single: vi.fn(async () => ({
          data: { id: options.reportId ?? "report-1" },
          error: null,
        })),
        then(
          resolve: (value: {
            data: unknown[] | null;
            count: number | null;
            error: null;
          }) => void,
        ) {
          if (builder.insertPayload !== undefined) {
            return Promise.resolve({
              data: null,
              count: null,
              error: null,
            }).then(resolve);
          }

          return Promise.resolve({
            data: null,
            count: options.rateCount ?? 0,
            error: null,
          }).then(resolve);
        },
      };
      return builder;
    },
  };

  return client;
}

async function post(body?: unknown) {
  const { POST } = await import("../route");
  return POST(
    new Request("https://1wayseo.com/api/public/audit", {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    }),
  );
}

describe("public audit API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    supabaseMocks.createAdminClient.mockReturnValue(createSupabaseMock());
    vi.resetModules();
  });

  it("returns 400 turnstile_invalid when the turnstile token is missing", async () => {
    const response = await post({ url: "https://example.com" });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "turnstile_invalid",
    });
    expect(auditMocks.auditWebsite).not.toHaveBeenCalled();
  });

  it("returns 400 turnstile_invalid when turnstile verification fails", async () => {
    const verifyFetch = vi.fn(async () =>
      Response.json({ success: false, "error-codes": ["invalid-input"] }),
    );
    vi.stubGlobal("fetch", verifyFetch);

    const response = await post({
      url: "https://example.com",
      turnstileToken: "bad-token",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "turnstile_invalid",
    });
    expect(verifyFetch).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("bad-token"),
      }),
    );
    expect(auditMocks.auditWebsite).not.toHaveBeenCalled();
  });

  it("returns 429 when the IP hash has reached the hourly rate limit", async () => {
    const verifyFetch = vi.fn(async () => Response.json({ success: true }));
    vi.stubGlobal("fetch", verifyFetch);
    const supabase = createSupabaseMock({ rateCount: 5 });
    supabaseMocks.createAdminClient.mockReturnValue(supabase);

    const response = await post({
      url: "https://example.com",
      turnstileToken: "valid-token",
    });

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      error: "rate_limited",
    });
    expect(supabase.calls).toContainEqual(
      expect.objectContaining({
        table: "audit_lead_inquiries",
        method: "select",
      }),
    );
    expect(auditMocks.auditWebsite).not.toHaveBeenCalled();
  });

  it("returns a 24h cached lead-gen report without calling auditWebsite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true })),
    );
    const supabase = createSupabaseMock({
      cachedReport: {
        id: "cached-report-1",
        health_score: 72,
        scanned_at: "2026-05-21T01:00:00.000Z",
        raw_payload: {
          id: "audit-run-1",
          url: "https://example.com/",
          scannedAt: "2026-05-21T01:00:00.000Z",
          pagesScanned: 1,
          healthScore: 72,
          issues: [
            {
              ruleId: "meta.description.missing",
              severity: "critical",
              riskLevel: "high",
              page: "https://example.com/",
              selector: "meta[name=description]",
              current: "Missing meta description",
              suggested: "Add a concise meta description",
              source: "html-scan",
              estimatedImpact: "high",
            },
          ],
        },
      },
    });
    supabaseMocks.createAdminClient.mockReturnValue(supabase);

    const response = await post({
      url: "https://example.com",
      turnstileToken: "valid-token",
    });

    expect(response.status).toBe(200);
    expect(auditMocks.auditWebsite).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      reportId: "cached-report-1",
      healthScore: 72,
      totalIssues: 1,
      topIssues: [
        {
          rule: "meta.description.missing",
          page: "https://example.com/",
          impact: "Add a concise meta description",
        },
      ],
    });
  });

  it("runs a fresh audit and inserts report and lead inquiry on the happy path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true })),
    );
    const supabase = createSupabaseMock({ reportId: "lead-report-1" });
    supabaseMocks.createAdminClient.mockReturnValue(supabase);
    auditMocks.auditWebsite.mockResolvedValue({
      id: "audit-run-1",
      url: "https://example.com/",
      scannedAt: "2026-05-21T02:00:00.000Z",
      pagesScanned: 1,
      healthScore: 64,
      issues: [
        {
          ruleId: "meta.description.missing",
          severity: "critical",
          riskLevel: "high",
          page: "https://example.com/",
          selector: "meta[name=description]",
          current: "Missing meta description",
          suggested: "Add a concise meta description",
          source: "html-scan",
          estimatedImpact: "high",
        },
      ],
    });

    const response = await post({
      url: "https://example.com",
      turnstileToken: "valid-token",
    });

    expect(response.status).toBe(200);
    expect(auditMocks.auditWebsite).toHaveBeenCalledWith({
      url: "https://example.com/",
      scope: "single-page",
    });
    expect(supabase.calls).toContainEqual(
      expect.objectContaining({
        table: "audit_reports",
        method: "insert",
      }),
    );
    expect(supabase.calls).toContainEqual(
      expect.objectContaining({
        table: "audit_lead_inquiries",
        method: "insert",
      }),
    );
    await expect(response.json()).resolves.toMatchObject({
      reportId: "lead-report-1",
      healthScore: 64,
      totalIssues: 1,
    });
  });

  it("returns 502 when auditWebsite cannot fetch the target website", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: true })),
    );
    const supabase = createSupabaseMock();
    supabaseMocks.createAdminClient.mockReturnValue(supabase);
    auditMocks.auditWebsite.mockRejectedValue(new Error("audit_fetch_failed"));

    const response = await post({
      url: "https://example.com",
      turnstileToken: "valid-token",
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      error: "audit_fetch_failed",
    });
    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({
        table: "audit_reports",
        method: "insert",
      }),
    );
  });
});
