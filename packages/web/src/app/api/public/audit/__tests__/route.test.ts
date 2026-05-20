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

function createSupabaseMock(options: { rateCount?: number } = {}) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];

  const client = {
    calls,
    from(table: TableName) {
      const builder = {
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
        then(
          resolve: (value: {
            data: unknown[] | null;
            count: number | null;
            error: null;
          }) => void,
        ) {
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
});
