import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrandNotFoundError, QuotaExceededError } from "@/lib/quota/errors";

const mocks = vi.hoisted(() => ({
  createArticleJobs: vi.fn(),
}));

vi.mock("@/lib/api/request-user", () => ({
  resolveRequestUser: vi.fn(async () => ({
    success: true,
    user: {
      id: "user-1",
      email: "user@example.com",
    },
  })),
}));

vi.mock("@/lib/security/rate-limiter", () => ({
  checkRateLimit: vi.fn(async () => null),
  RATE_LIMIT_CONFIGS: {
    ARTICLE_GENERATE: {},
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

vi.mock("@/lib/article-jobs/factory", () => ({
  createSupabaseArticleJobGenerationService: vi.fn(() => ({
    createArticleJobs: mocks.createArticleJobs,
  })),
}));

vi.mock("@/lib/article-jobs/dispatch", () => ({
  resolveArticleJobsGitHubConfig: vi.fn(() => ({
    token: null,
    owner: null,
    repo: null,
  })),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "job-1"),
}));

vi.mock("@/lib/billing/article-quota-service", () => ({
  ArticleQuotaService: vi.fn(),
}));

describe("POST /api/articles/generate brand quota handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 402 with upsell payload when article quota is exceeded", async () => {
    mocks.createArticleJobs.mockRejectedValueOnce(
      new QuotaExceededError({
        resource: "articles",
        used: 30,
        cap: 30,
        plan: "solo",
      }),
    );

    const response = await postGenerate({ title: "SEO", brandId: "brand-1" });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "quota_exceeded",
      resource: "articles",
      used: 30,
      cap: 30,
      plan: "solo",
      upgradeUrl: "/dashboard/settings#upgrade",
    });
  });

  it("returns 200 with a job id when quota allows generation", async () => {
    mocks.createArticleJobs.mockResolvedValueOnce({
      success: true,
      createdJobs: [
        {
          id: "job-1",
          keyword: "SEO",
          title: "SEO",
          reservationStatus: "reserved",
        },
      ],
      skippedJobs: [],
      failedItems: [],
      counts: {
        created: 1,
        skipped: 0,
        failed: 0,
      },
      quota: {
        requiredArticles: 1,
        reservedArticles: 1,
        availableArticles: 29,
      },
      dispatch: {
        attempted: true,
        status: "triggered",
      },
    });

    const response = await postGenerate({ title: "SEO", brandId: "brand-1" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "job-1",
      message: "文章生成任務已建立，將在背景處理中",
    });
  });

  it("returns 404 when the selected brand does not belong to the company", async () => {
    mocks.createArticleJobs.mockRejectedValueOnce(
      new BrandNotFoundError("other-brand"),
    );

    const response = await postGenerate({
      title: "SEO",
      brandId: "other-brand",
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "brand_not_found",
      brandId: "other-brand",
    });
  });
});

async function postGenerate(body: Record<string, unknown>) {
  const { POST } = await import("../route");

  return POST(
    new Request("https://example.com/api/articles/generate", {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json",
      },
    }) as never,
  );
}
