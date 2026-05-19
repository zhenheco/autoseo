import { beforeEach, describe, expect, it, vi } from "vitest";

const brevo = vi.hoisted(() => ({
  syncAllUsersToBrevo: vi.fn(),
}));

vi.mock("@/lib/brevo", () => ({
  syncAllUsersToBrevo: brevo.syncAllUsersToBrevo,
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/agents/orchestrator", () => ({
  ParallelOrchestrator: vi.fn(),
}));

vi.mock("@/lib/services/article-storage", () => ({
  ArticleStorageService: vi.fn(),
}));

function request(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  };
}

function createMonitorSupabase() {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  return {
    calls,
    from(table: string) {
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
          return Promise.resolve({
            data: [],
            error: null,
          });
        },
        then<TResult1 = { data: unknown[]; error: null }, TResult2 = never>(
          onfulfilled?:
            | ((value: { data: unknown[]; error: null }) => TResult1)
            | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          return Promise.resolve({
            data: [],
            error: null,
          }).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

describe("Brevo and monitor cron routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
  });

  it("sync-brevo GET uses the standard cron response when the secret is missing", async () => {
    const { GET } = await import("../sync-brevo/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("sync-brevo POST uses the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { POST } = await import("../sync-brevo/route");

    const response = await POST(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("sync-brevo runs the Brevo sync when cron auth passes", async () => {
    process.env.CRON_SECRET = "cron-secret";
    brevo.syncAllUsersToBrevo.mockResolvedValue({
      synced: 2,
      errors: 1,
      skipped: 3,
    });
    const { GET } = await import("../sync-brevo/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      synced: 2,
      errors: 1,
      skipped: 3,
    });
    expect(brevo.syncAllUsersToBrevo).toHaveBeenCalledTimes(1);
  });

  it("monitor article jobs uses the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { POST } = await import("../monitor-article-jobs/route");

    const response = await POST(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("monitor article jobs returns the existing summary when cron auth passes", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createMonitorSupabase();
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { POST } = await import("../monitor-article-jobs/route");

    const response = await POST(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stats: {
        totalProcessing: 0,
        timedOut: 0,
        stuck: 0,
        retried: 0,
        completedButNotSaved: 0,
        errors: [],
      },
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "eq",
      args: ["status", "processing"],
    });
  });
});
