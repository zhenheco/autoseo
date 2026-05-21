import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "job-1"),
}));

vi.mock("@/lib/billing/article-quota-service", () => ({
  ArticleQuotaService: vi.fn(),
}));

vi.mock("@/lib/search/search-router", () => ({
  createSearchRouter: vi.fn(),
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: vi.fn(),
  RATE_LIMIT_CONFIGS: {
    ARTICLE_GENERATE: {},
    ARTICLE_GENERATE_BATCH: {},
  },
}));

vi.mock("@/lib/cache/redis-cache", () => ({
  cacheSet: vi.fn(),
  isRedisAvailable: vi.fn(() => false),
  CACHE_CONFIG: {
    PENDING_ARTICLE_JOBS: {
      prefix: "pending",
      ttl: 60,
    },
  },
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
        limit(...args: unknown[]) {
          calls.push({ table, method: "limit", args });
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
        update(...args: unknown[]) {
          operation = "update";
          calls.push({ table, method: "update", args });
          return builder;
        },
        delete() {
          operation = "delete";
          calls.push({ table, method: "delete", args: [] });
          return builder;
        },
        upsert(...args: unknown[]) {
          calls.push({ table, method: "upsert", args });
          return Promise.resolve(responses[`${table}.upsert`] ?? {});
        },
        maybeSingle<T>() {
          calls.push({ table, method: "maybeSingle", args: [] });
          return Promise.resolve(
            (responses[`${table}.maybeSingle`] ?? {}) as {
              data?: T | null;
              error?: { message?: string } | null;
            },
          );
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

describe("Article generation JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for malformed single-generation JSON", async () => {
    const { POST } = await import("../generate/route");

    const response = await POST({
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns 400 for empty single-generation body", async () => {
    const { POST } = await import("../generate/route");

    const response = await POST(
      new Request("https://example.com/api/articles/generate", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns 400 when single-generation body misses title and industry", async () => {
    const { POST } = await import("../generate/route");

    const response = await POST({
      json: () => Promise.resolve({}),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Title or industry is required",
    });
  });

  it("returns 400 when single-generation strategy fields are incomplete", async () => {
    const { POST } = await import("../generate/route");

    const response = await POST({
      json: () =>
        Promise.resolve({
          industry: "SEO",
          language: "zh-TW",
        }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Region is required",
    });
  });

  it("returns 400 for malformed batch-generation JSON", async () => {
    const { POST } = await import("../generate-batch/route");

    const response = await POST({
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns 400 for empty batch-generation body", async () => {
    const { POST } = await import("../generate-batch/route");

    const response = await POST(
      new Request("https://example.com/api/articles/generate-batch", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns 400 when batch-generation body has no items or keywords", async () => {
    const { POST } = await import("../generate-batch/route");

    const response = await POST({
      json: () => Promise.resolve({}),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Items or keywords array is required",
    });
  });

  it("returns 400 when a batch-generation item has no keyword or title", async () => {
    const { POST } = await import("../generate-batch/route");

    const response = await POST({
      json: () => Promise.resolve({ items: [{}] }),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "每個項目都必須包含 keyword 或 title",
    });
  });

  it("returns 400 when a batch-generation keyword is too long", async () => {
    const { POST } = await import("../generate-batch/route");

    const response = await POST({
      json: () => Promise.resolve({ keywords: ["x".repeat(501)] }),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "關鍵字長度不能超過 500 字元",
    });
  });

  it("returns 401 when batch generation has no authenticated user", async () => {
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

    const { POST } = await import("../generate-batch/route");
    const response = await POST({
      json: () => Promise.resolve({ keywords: ["seo"] }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Unauthorized",
    });
  });

  it("returns the legacy 402 response when single generation has no active subscription", async () => {
    const { createClient: createCookieClient } = await import(
      "@shared/supabase"
    );
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const supabase = createFakeSupabase({
      "company_members.maybeSingle": {
        data: null,
        error: null,
      },
      "company_subscriptions.single": {
        data: null,
        error: { message: "No rows returned" },
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
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);

    const { POST } = await import("../generate/route");
    const response = await POST({
      json: () => Promise.resolve({ title: "SEO" }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "找不到有效的訂閱，請聯絡客服信箱處理",
    });
    expect(supabase.calls).toEqual([
      { table: "company_members", method: "select", args: ["company_id"] },
      { table: "company_members", method: "eq", args: ["user_id", "user-1"] },
      { table: "company_members", method: "eq", args: ["status", "active"] },
      { table: "company_members", method: "limit", args: [1] },
      { table: "company_members", method: "maybeSingle", args: [] },
      {
        table: "company_subscriptions",
        method: "select",
        args: ["id, status"],
      },
      {
        table: "company_subscriptions",
        method: "eq",
        args: ["company_id", "user-1"],
      },
      {
        table: "company_subscriptions",
        method: "eq",
        args: ["status", "active"],
      },
      { table: "company_subscriptions", method: "single", args: [] },
    ]);
    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({
        table: "website_configs",
      }),
    );
    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({
        table: "article_jobs",
      }),
    );
  });

  it("returns 402 for batch generation before website and job work when no active subscription exists", async () => {
    const { createClient: createCookieClient, createAdminClient } =
      await import("@shared/supabase");
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const cookieClient = {
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
        })),
      },
    };
    const adminClient = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.single": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: null,
        error: { message: "No rows returned" },
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue(cookieClient as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);

    const { POST } = await import("../generate-batch/route");
    const response = await POST({
      json: () => Promise.resolve({ keywords: ["seo"] }),
    } as never);

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "找不到有效的訂閱，請聯絡客服信箱處理",
    });
    expect(adminClient.calls).toContainEqual({
      table: "company_subscriptions",
      method: "select",
      args: ["id, status"],
    });
    expect(adminClient.calls).not.toContainEqual(
      expect.objectContaining({
        table: "website_configs",
      }),
    );
    expect(adminClient.calls).not.toContainEqual(
      expect.objectContaining({
        table: "article_jobs",
      }),
    );
  });

  it("returns the legacy batch success response through the article job intake service", async () => {
    const { createClient: createCookieClient, createAdminClient } =
      await import("@shared/supabase");
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const { ArticleQuotaService } = await import(
      "@/lib/billing/article-quota-service"
    );
    const reserveArticles = vi.fn(async () => ({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 4,
      totalReserved: 1,
    }));
    const adminClient = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.maybeSingle": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
      "website_configs.maybeSingle": {
        data: {
          id: "website-1",
        },
        error: null,
      },
      "article_jobs.list": {
        data: [],
        error: null,
      },
      "article_jobs.insert": {
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(ArticleQuotaService).mockImplementation(function () {
      return {
        reserveArticles,
      };
    } as never);

    const { POST } = await import("../generate-batch/route");
    const response = await POST({
      json: () => Promise.resolve({ keywords: ["seo"] }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      jobIds: ["job-1"],
      newJobs: 1,
      skippedJobs: 0,
      failedJobs: 0,
      failedItems: [],
      message: "已建立 1 個新任務",
      polling: {
        statusUrl: "/api/articles/status/[jobId]",
        recommendedInterval: 60000,
      },
    });
    expect(reserveArticles).toHaveBeenCalledWith("company-1", "job-1", 1);
  });

  it("accepts bearer token auth for batch generation", async () => {
    const { createClient: createCookieClient, createAdminClient } =
      await import("@shared/supabase");
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const { ArticleQuotaService } = await import(
      "@/lib/billing/article-quota-service"
    );
    const reserveArticles = vi.fn(async () => ({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 4,
      totalReserved: 1,
    }));
    const adminClient = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.maybeSingle": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
      "website_configs.maybeSingle": {
        data: {
          id: "website-1",
        },
        error: null,
      },
      "article_jobs.list": {
        data: [],
        error: null,
      },
      "article_jobs.insert": {
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: null,
          },
        })),
      },
    } as never);
    vi.mocked(createSupabaseClient).mockReturnValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
          error: null,
        })),
      },
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(adminClient as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(ArticleQuotaService).mockImplementation(function () {
      return {
        reserveArticles,
      };
    } as never);

    const { POST } = await import("../generate-batch/route");
    const response = await POST({
      json: () => Promise.resolve({ keywords: ["seo"] }),
      headers: new Headers({ authorization: "Bearer token-1" }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      jobIds: ["job-1"],
    });
    expect(createCookieClient).not.toHaveBeenCalled();
    expect(reserveArticles).toHaveBeenCalledWith("company-1", "job-1", 1);
  });

  it("returns an existing single-generation job without inserting a duplicate", async () => {
    const { createClient: createCookieClient } = await import(
      "@shared/supabase"
    );
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const { ArticleQuotaService } = await import(
      "@/lib/billing/article-quota-service"
    );
    const reserveArticles = vi.fn();
    const supabase = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.maybeSingle": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
      "website_configs.maybeSingle": {
        data: {
          id: "website-1",
        },
        error: null,
      },
      "article_jobs.list": {
        data: [
          {
            id: "existing-job",
            status: "pending",
            keywords: ["SEO"],
          },
        ],
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
        })),
      },
    } as never);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(ArticleQuotaService).mockImplementation(function () {
      return {
        reserveArticles,
      };
    } as never);

    const { POST } = await import("../generate/route");
    const response = await POST({
      json: () => Promise.resolve({ title: "SEO" }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "existing-job",
      message: "文章生成任務已存在，正在背景處理中",
    });
    expect(supabase.calls).not.toContainEqual(
      expect.objectContaining({
        table: "article_jobs",
        method: "insert",
      }),
    );
    expect(reserveArticles).not.toHaveBeenCalled();
  });

  it("returns the legacy single-generation success response through the article job intake service", async () => {
    const { createClient: createCookieClient } = await import(
      "@shared/supabase"
    );
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const { ArticleQuotaService } = await import(
      "@/lib/billing/article-quota-service"
    );
    const reserveArticles = vi.fn(async () => ({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 4,
      totalReserved: 1,
    }));
    const supabase = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.maybeSingle": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
      "website_configs.maybeSingle": {
        data: {
          id: "website-1",
        },
        error: null,
      },
      "article_jobs.list": {
        data: [],
        error: null,
      },
      "article_jobs.insert": {
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
        })),
      },
    } as never);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(ArticleQuotaService).mockImplementation(function () {
      return {
        reserveArticles,
      };
    } as never);

    const { POST } = await import("../generate/route");
    const response = await POST({
      json: () => Promise.resolve({ title: "SEO" }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "job-1",
      message: "文章生成任務已建立，將在背景處理中",
    });
    expect(reserveArticles).toHaveBeenCalledWith("company-1", "job-1", 1);
  });

  it("releases the article reservation and deletes the job when competitor quota is denied", async () => {
    const { createClient: createCookieClient } = await import(
      "@shared/supabase"
    );
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const { ArticleQuotaService } = await import(
      "@/lib/billing/article-quota-service"
    );
    const { createSearchRouter } = await import("@/lib/search/search-router");
    const reserveArticles = vi.fn(async () => ({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 4,
      totalReserved: 1,
    }));
    const releaseReservation = vi.fn(async () => true);
    const supabase = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.maybeSingle": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
      "website_configs.maybeSingle": {
        data: { id: "website-1" },
        error: null,
      },
      "article_jobs.list": {
        data: [],
        error: null,
      },
      "article_jobs.insert": {
        error: null,
      },
      "article_jobs.delete": {
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
        })),
      },
    } as never);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(ArticleQuotaService).mockImplementation(function () {
      return {
        reserveArticles,
        releaseReservation,
      };
    } as never);
    vi.mocked(createSearchRouter).mockReturnValue({
      analyzeCompetitors: vi.fn(async () => ({
        allowed: false,
        message: "配額不足",
      })),
    } as never);

    const { POST } = await import("../generate/route");
    const response = await POST({
      json: () =>
        Promise.resolve({
          title: "SEO",
          competitors: ["https://example.com"],
        }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Quota exceeded",
      message: "配額不足",
    });
    expect(releaseReservation).toHaveBeenCalledWith("job-1");
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "delete",
      args: [],
    });
  });

  it("updates job metadata when competitor analysis is allowed", async () => {
    const { createClient: createCookieClient } = await import(
      "@shared/supabase"
    );
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const { checkRateLimit } = await import("@/lib/security/rate-limiter");
    const { ArticleQuotaService } = await import(
      "@/lib/billing/article-quota-service"
    );
    const { createSearchRouter } = await import("@/lib/search/search-router");
    const reserveArticles = vi.fn(async () => ({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 4,
      totalReserved: 1,
    }));
    const releaseReservation = vi.fn(async () => true);
    const supabase = createFakeSupabase({
      "company_members.maybeSingle": {
        data: {
          company_id: "company-1",
        },
        error: null,
      },
      "companies.maybeSingle": {
        data: {
          id: "company-1",
        },
        error: null,
      },
      "company_subscriptions.single": {
        data: {
          id: "subscription-1",
          status: "active",
        },
        error: null,
      },
      "website_configs.maybeSingle": {
        data: { id: "website-1" },
        error: null,
      },
      "article_jobs.list": {
        data: [],
        error: null,
      },
      "article_jobs.insert": {
        error: null,
      },
      "article_jobs.update": {
        error: null,
      },
    });

    vi.mocked(createCookieClient).mockResolvedValue({
      auth: {
        getUser: vi.fn(async () => ({
          data: {
            user: {
              id: "user-1",
              email: "user@example.com",
            },
          },
        })),
      },
    } as never);
    vi.mocked(createSupabaseClient).mockReturnValue(supabase as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(ArticleQuotaService).mockImplementation(function () {
      return {
        reserveArticles,
        releaseReservation,
      };
    } as never);
    vi.mocked(createSearchRouter).mockReturnValue({
      analyzeCompetitors: vi.fn(async () => ({
        allowed: true,
        results: [{ content: "strategy", provider: "perplexity" }],
      })),
    } as never);

    const { POST } = await import("../generate/route");
    const response = await POST({
      json: () =>
        Promise.resolve({
          title: "SEO",
          competitors: ["https://example.com"],
        }),
      headers: new Headers(),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "job-1",
      message: "文章生成任務已建立，將在背景處理中",
    });
    expect(supabase.calls).toContainEqual({
      table: "article_jobs",
      method: "update",
      args: [
        {
          metadata: expect.objectContaining({
            title: "SEO",
            competitorAnalysis: [
              { content: "strategy", provider: "perplexity" },
            ],
          }),
        },
      ],
    });
    expect(releaseReservation).not.toHaveBeenCalled();
  });
});
