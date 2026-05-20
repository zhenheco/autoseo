import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/agents/orchestrator", () => ({
  ParallelOrchestrator: vi.fn(),
}));

function request(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  };
}

function createFakeSupabase(
  response: { data?: unknown; error?: unknown },
  options: {
    lockResponse?: { data?: unknown; error?: unknown };
    updateResponse?: { data?: unknown; error?: unknown };
  } = {},
) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  return {
    calls,
    from(table: string) {
      let isUpdateQuery = false;
      const builder = {
        update(...args: unknown[]) {
          calls.push({ table, method: "update", args });
          isUpdateQuery = true;
          return builder;
        },
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
          if (isUpdateQuery) {
            return Promise.resolve(options.lockResponse ?? response);
          }
          return builder;
        },
        eq(...args: unknown[]) {
          calls.push({ table, method: "eq", args });
          return builder;
        },
        in(...args: unknown[]) {
          calls.push({ table, method: "in", args });
          return builder;
        },
        or(...args: unknown[]) {
          calls.push({ table, method: "or", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
          return Promise.resolve(response);
        },
        then<TResult1 = { data?: unknown; error?: unknown }, TResult2 = never>(
          onfulfilled?:
            | ((value: { data?: unknown; error?: unknown }) => TResult1)
            | null,
          onrejected?: ((reason: unknown) => TResult2) | null,
        ) {
          return Promise.resolve(
            options.updateResponse ?? { error: null },
          ).then(onfulfilled, onrejected);
        },
      };

      return builder;
    },
  };
}

describe("process article jobs cron route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
  });

  it("uses the standard cron response when the secret is missing", async () => {
    const { GET } = await import("../process-article-jobs/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
    });
  });

  it("uses the standard cron response when the token is wrong", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { GET } = await import("../process-article-jobs/route");

    const response = await GET(request("wrong") as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "UNAUTHORIZED",
    });
  });

  it("returns the existing no-jobs payload when cron auth passes", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = createFakeSupabase({
      data: [],
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const { GET } = await import("../process-article-jobs/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: "No jobs to process",
      processed: 0,
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "select",
      args: ["*"],
    });
  });

  it("fails jobs with an unknown saved pipeline phase without running the orchestrator", async () => {
    process.env.CRON_SECRET = "cron-secret";
    const job = {
      id: "job-1",
      status: "processing",
      company_id: "company-1",
      website_id: "website-1",
      keywords: ["keyword"],
      metadata: {
        current_phase: "unknown_phase",
      },
    };
    const supabase = createFakeSupabase(
      {
        data: [job],
        error: null,
      },
      {
        lockResponse: {
          data: [job],
          error: null,
        },
      },
    );
    const { createAdminClient } = await import("@/lib/supabase/server");
    const { ParallelOrchestrator } = await import("@/lib/agents/orchestrator");
    vi.mocked(createAdminClient).mockReturnValue(supabase as never);
    const execute = vi.fn();
    vi.mocked(ParallelOrchestrator).mockImplementation(function () {
      return { execute };
    } as never);
    const { GET } = await import("../process-article-jobs/route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      processed: 1,
      results: [
        {
          jobId: "job-1",
          status: "failed",
          error: "Unknown article pipeline phase: unknown_phase",
        },
      ],
    });
    expect(execute).not.toHaveBeenCalled();
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "update",
      args: [
        expect.objectContaining({
          status: "failed",
          metadata: expect.objectContaining({
            error: "Unknown article pipeline phase: unknown_phase",
          }),
        }),
      ],
    });
  });
});
