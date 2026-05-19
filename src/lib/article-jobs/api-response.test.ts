import { describe, expect, it } from "vitest";
import {
  articleJobGenerationBatchResponse,
  articleJobGenerationSingleResponse,
  articleJobIntakeBatchResponse,
  articleJobIntakeSingleResponse,
} from "./api-response";
import type { ArticleJobIntakeResult } from "./job-intake";
import type { ArticleJobGenerationResult } from "./generation-service";

function createResult(
  overrides: Partial<ArticleJobIntakeResult> = {},
): ArticleJobIntakeResult {
  return {
    success: true,
    createdJobs: [],
    skippedJobs: [],
    failedItems: [],
    counts: {
      created: 0,
      skipped: 0,
      failed: 0,
    },
    quota: {
      requiredArticles: 0,
      reservedArticles: 0,
      availableArticles: 0,
    },
    dispatch: {
      attempted: false,
      status: "not_needed",
    },
    ...overrides,
  };
}

describe("articleJobIntakeSingleResponse", () => {
  it("returns the legacy single-generation success response", async () => {
    const response = articleJobIntakeSingleResponse(
      createResult({
        createdJobs: [
          {
            id: "job-1",
            keyword: "seo",
            title: "SEO",
            reservationStatus: "reserved",
          },
        ],
        counts: {
          created: 1,
          skipped: 0,
          failed: 0,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "job-1",
      message: "文章生成任務已建立，將在背景處理中",
    });
  });

  it("maps insufficient quota failures to 402", async () => {
    const response = articleJobIntakeSingleResponse(
      createResult({
        success: false,
        failedItems: [
          {
            keyword: "seo",
            reason: "insufficient_quota",
            message: "額度不足",
          },
        ],
        counts: {
          created: 0,
          skipped: 0,
          failed: 1,
        },
        quota: {
          requiredArticles: 1,
          reservedArticles: 0,
          availableArticles: 0,
        },
      }),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "Insufficient quota",
      message: "額度不足",
      availableArticles: 0,
      reservedArticles: 0,
      upgradeUrl: "/dashboard/subscription",
    });
  });

  it("maps non-quota failures to 500", async () => {
    const response = articleJobIntakeSingleResponse(
      createResult({
        success: false,
        failedItems: [
          {
            keyword: "seo",
            reason: "job_insert_failed",
            message: "insert failed",
          },
        ],
        counts: {
          created: 0,
          skipped: 0,
          failed: 1,
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create article job",
      details: "insert failed",
    });
  });

  it("maps competitor quota failures to the legacy 403 response", async () => {
    const response = articleJobIntakeSingleResponse(
      createResult({
        success: false,
        failedItems: [
          {
            keyword: "seo",
            reason: "competitor_quota_exceeded",
            message: "配額不足",
          },
        ],
        counts: {
          created: 0,
          skipped: 0,
          failed: 1,
        },
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Quota exceeded",
      message: "配額不足",
    });
  });

  it("returns an existing pending job as a successful single-generation response", async () => {
    const response = articleJobIntakeSingleResponse(
      createResult({
        skippedJobs: [
          {
            id: "job-1",
            keyword: "seo",
            reason: "duplicate_pending_job",
          },
        ],
        counts: {
          created: 0,
          skipped: 1,
          failed: 0,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "job-1",
      message: "文章生成任務已存在，正在背景處理中",
    });
  });
});

describe("articleJobIntakeBatchResponse", () => {
  it("returns legacy batch response with created and skipped jobs", async () => {
    const response = articleJobIntakeBatchResponse(
      createResult({
        createdJobs: [
          {
            id: "job-1",
            keyword: "seo",
            title: "SEO",
            reservationStatus: "reserved",
          },
        ],
        skippedJobs: [
          {
            id: "job-2",
            keyword: "content",
            reason: "duplicate_pending_job",
          },
        ],
        counts: {
          created: 1,
          skipped: 1,
          failed: 0,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      jobIds: ["job-1", "job-2"],
      newJobs: 1,
      skippedJobs: 1,
      failedJobs: 0,
      failedItems: [],
      message: "已建立 1 個新任務，1 個已在處理中",
      polling: {
        statusUrl: "/api/articles/status/[jobId]",
        recommendedInterval: 60000,
      },
    });
  });

  it("returns 500 when every batch item fails", async () => {
    const response = articleJobIntakeBatchResponse(
      createResult({
        success: false,
        failedItems: [
          {
            keyword: "seo",
            reason: "job_insert_failed",
            message: "insert failed",
          },
        ],
        counts: {
          created: 0,
          skipped: 0,
          failed: 1,
        },
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "所有文章任務建立失敗",
      failedItems: ["seo"],
    });
  });

  it("maps all-insufficient-quota batch failures to 402", async () => {
    const response = articleJobIntakeBatchResponse(
      createResult({
        success: false,
        failedItems: [
          {
            keyword: "seo",
            reason: "insufficient_quota",
            message: "額度不足：需要 1 篇，實際可用 0 篇",
          },
        ],
        counts: {
          created: 0,
          skipped: 0,
          failed: 1,
        },
        quota: {
          requiredArticles: 1,
          reservedArticles: 2,
          availableArticles: 0,
        },
      }),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Insufficient quota",
      message: "額度不足：需要 1 篇，實際可用 0 篇",
      requiredCredits: 1,
      availableCredits: 0,
      reservedCredits: 2,
      failedItems: ["seo"],
    });
  });
});

describe("articleJobGenerationSingleResponse", () => {
  it("preserves the legacy missing subscription response", async () => {
    const response = articleJobGenerationSingleResponse({
      success: false,
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "找不到有效的訂閱，請聯絡客服信箱處理",
      },
    });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "找不到有效的訂閱，請聯絡客服信箱處理",
    });
  });

  it("delegates intake results to the single intake response mapper", async () => {
    const result: ArticleJobGenerationResult = createResult({
      createdJobs: [
        {
          id: "job-1",
          keyword: "seo",
          title: "SEO",
          reservationStatus: "reserved",
        },
      ],
      counts: {
        created: 1,
        skipped: 0,
        failed: 0,
      },
    });

    const response = articleJobGenerationSingleResponse(result);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      articleJobId: "job-1",
      message: "文章生成任務已建立，將在背景處理中",
    });
  });
});

describe("articleJobGenerationBatchResponse", () => {
  it("preserves the missing subscription response for batch generation", async () => {
    const response = articleJobGenerationBatchResponse({
      success: false,
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "找不到有效的訂閱，請聯絡客服信箱處理",
      },
    });

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "找不到有效的訂閱，請聯絡客服信箱處理",
    });
  });

  it("delegates intake results to the batch intake response mapper", async () => {
    const response = articleJobGenerationBatchResponse(
      createResult({
        createdJobs: [
          {
            id: "job-1",
            keyword: "seo",
            title: "SEO",
            reservationStatus: "reserved",
          },
        ],
        counts: {
          created: 1,
          skipped: 0,
          failed: 0,
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      jobIds: ["job-1"],
      newJobs: 1,
    });
  });
});
