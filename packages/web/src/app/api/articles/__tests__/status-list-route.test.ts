import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

interface FakeResponse {
  data?: unknown;
  error?: { message: string } | null;
}

function createFakeSupabase(responses: Record<string, FakeResponse>) {
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
        single<T>() {
          calls.push({ table, method: "single", args: [] });
          return Promise.resolve(
            (responses[`${table}.single`] ?? {}) as {
              data?: T | null;
              error?: { message?: string } | null;
            },
          );
        },
      };

      return builder;
    },
  };
}

function request(url: string, headers = new Headers()) {
  return {
    headers,
    nextUrl: new URL(url),
  };
}

describe("Article status list route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("requires a job id", async () => {
    const { GET } = await import("../status/route");

    const response = await GET(
      request("https://example.com/api/articles/status") as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Job ID is required",
    });
  });

  it("keeps the legacy unauthorized response when no cookie user exists", async () => {
    const { createClient: createCookieClient } = await import(
      "@shared/supabase"
    );

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: null,
          },
        })),
      },
    } as never);

    const { GET } = await import("../status/route");
    const response = await GET(
      request("https://example.com/api/articles/status?jobId=job-1") as never,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("returns pending status for the owner through cookie auth", async () => {
    const { createClient: createCookieClient, createAdminClient } =
      await import("@shared/supabase");
    const serviceSupabase = createFakeSupabase({
      "article_jobs.single": {
        data: {
          id: "job-1",
          user_id: "user-1",
          company_id: "company-1",
          status: "processing",
          metadata: {
            progress: 70,
            currentStep: "Writing",
          },
          started_at: "2026-01-01T00:00:00.000Z",
          completed_at: null,
          error_message: null,
        },
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
            },
          },
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(serviceSupabase as never);

    const { GET } = await import("../status/route");
    const response = await GET(
      request("https://example.com/api/articles/status?jobId=job-1") as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "processing",
      progress: 70,
      message: "Writing",
      metadata: {
        progress: 70,
        currentStep: "Writing",
      },
      startedAt: "2026-01-01T00:00:00.000Z",
      completedAt: null,
      error: null,
    });
  });

  it("supports bearer token auth for status checks", async () => {
    const { createAdminClient } = await import("@shared/supabase");
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const serviceSupabase = createFakeSupabase({
      "article_jobs.single": {
        data: {
          id: "job-1",
          user_id: "user-1",
          company_id: "company-1",
          status: "pending",
          metadata: {},
          started_at: null,
          completed_at: null,
          error_message: null,
        },
        error: null,
      },
    });
    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
            },
          },
          error: null,
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(serviceSupabase as never);

    const { GET } = await import("../status/route");
    const response = await GET(
      request(
        "https://example.com/api/articles/status?jobId=job-1",
        new Headers({ authorization: "Bearer token-1" }),
      ) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "pending",
      progress: 0,
      message: "任務排隊中...",
    });
  });
});
