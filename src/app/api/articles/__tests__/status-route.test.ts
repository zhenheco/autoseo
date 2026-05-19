import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
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

describe("Article status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns the legacy invalid token response", async () => {
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );

    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: { message: "JWT expired" },
        })),
      },
    } as never);

    const { GET } = await import("../status/[jobId]/route");
    const response = await GET(
      {
        headers: new Headers({ authorization: "Bearer bad-token" }),
      } as never,
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid token",
      details: "JWT expired",
    });
  });

  it("returns job status for the authenticated user's active company", async () => {
    const { createClient: createCookieClient, createAdminClient } =
      await import("@/lib/supabase/server");
    const serviceSupabase = createFakeSupabase({
      "company_members.single": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "article_jobs.single": {
        data: {
          id: "job-1",
          company_id: "company-1",
          status: "pending",
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

    const { GET } = await import("../status/[jobId]/route");
    const response = await GET(
      {
        headers: new Headers(),
      } as never,
      { params: Promise.resolve({ jobId: "job-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      id: "job-1",
      company_id: "company-1",
      status: "pending",
    });
    expect(serviceSupabase.calls).toContainEqual({
      table: "article_jobs",
      method: "eq",
      args: ["company_id", "company-1"],
    });
  });
});
