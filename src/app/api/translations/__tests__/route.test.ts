import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "authenticated",
        user: { id: "user-1", email: "acejou27@gmail.com" },
        supabase: {},
      }),
  ),
}));

const authMiddleware = vi.hoisted(() => ({
  withAuth: vi.fn(
    (handler) => (request: Request) =>
      handler(request, {
        user: { id: "user-1", email: "acejou27@gmail.com" },
        supabase: {},
      }),
  ),
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
}));

const cache = vi.hoisted(() => ({
  cacheSet: vi.fn(),
  isRedisAvailable: vi.fn(() => false),
  CACHE_CONFIG: {
    PENDING_TRANSLATION_JOBS: {
      prefix: "pending-translations",
      ttl: 60,
    },
  },
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/api/auth-middleware", () => authMiddleware);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/cache/redis-cache", () => cache);
vi.mock("uuid", () => ({
  v4: vi.fn(() => "translation-job-id"),
}));

interface FakeResponse {
  data?: unknown;
  error?: { message?: string } | null;
  count?: number | null;
}

function createFakeAdminClient(responses: Record<string, FakeResponse>) {
  const calls: Array<{
    table: string;
    method: string;
    args: unknown[];
  }> = [];

  const client = {
    calls,
    from(table: string) {
      let operation = "list";
      const builder = {
        select(...args: unknown[]) {
          calls.push({ table, method: "select", args });
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
        insert(...args: unknown[]) {
          operation = "insert";
          calls.push({ table, method: "insert", args });
          return builder;
        },
        order(...args: unknown[]) {
          calls.push({ table, method: "order", args });
          return builder;
        },
        range(...args: unknown[]) {
          calls.push({ table, method: "range", args });
          return builder;
        },
        single() {
          calls.push({ table, method: "single", args: [] });
          return Promise.resolve(responses[`${table}.single`] ?? {});
        },
        then<TResult1 = FakeResponse, TResult2 = never>(
          onfulfilled?:
            | ((value: FakeResponse) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(responses[`${table}.${operation}`] ?? {}).then(
            onfulfilled,
            onrejected,
          );
        },
      };

      return builder;
    },
  };

  return client;
}

describe("translations route auth and company scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("declares authenticated auth for creating and listing translation jobs", async () => {
    await import("../route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
    expect(routeAuth.withRouteAuth).toHaveBeenCalledTimes(2);
  });

  it("returns 400 for malformed create-translation JSON", async () => {
    const { POST } = await import("../route");

    const response = await POST({
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("creates translation jobs only for articles in the user's company scope", async () => {
    const adminClient = createFakeAdminClient({
      "company_members.single": {
        data: { company_id: "company-1" },
        error: null,
      },
      "generated_articles.list": {
        data: [
          {
            id: "article-1",
            title: "Article",
            website_id: "website-1",
            company_id: "company-1",
          },
        ],
        error: null,
      },
      "article_translations.list": {
        data: [],
        error: null,
      },
      "translation_jobs.insert": {
        error: null,
      },
    });
    supabaseAdmin.createAdminClient.mockReturnValue(adminClient);

    const { POST } = await import("../route");

    const response = await POST({
      json: () =>
        Promise.resolve({
          article_ids: ["article-1"],
          target_languages: ["en-US"],
        }),
    } as never);

    expect(adminClient.calls).toContainEqual({
      table: "company_members",
      method: "eq",
      args: ["user_id", "user-1"],
    });
    expect(adminClient.calls).toContainEqual({
      table: "generated_articles",
      method: "eq",
      args: ["company_id", "company-1"],
    });
    expect(adminClient.calls).toContainEqual({
      table: "translation_jobs",
      method: "insert",
      args: [
        [
          expect.objectContaining({
            company_id: "company-1",
            website_id: "website-1",
            user_id: "user-1",
            source_article_id: "article-1",
            target_languages: ["en-US"],
          }),
        ],
      ],
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        success: true,
        job_count: 1,
      },
    });
  });

  it("lists only translation jobs in the user's company scope", async () => {
    const adminClient = createFakeAdminClient({
      "company_members.single": {
        data: { company_id: "company-1" },
        error: null,
      },
      "translation_jobs.list": {
        data: [{ id: "job-1", company_id: "company-1" }],
        error: null,
        count: 1,
      },
    });
    supabaseAdmin.createAdminClient.mockReturnValue(adminClient);

    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://example.com/api/translations?status=pending",
      ) as never,
    );

    expect(adminClient.calls).toContainEqual({
      table: "translation_jobs",
      method: "eq",
      args: ["company_id", "company-1"],
    });
    expect(adminClient.calls).toContainEqual({
      table: "translation_jobs",
      method: "eq",
      args: ["status", "pending"],
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        jobs: [{ id: "job-1", company_id: "company-1" }],
        total: 1,
      },
    });
  });
});
