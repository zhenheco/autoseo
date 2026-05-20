import { describe, expect, it, vi } from "vitest";
import { createArticleJobIntakeService } from "./intake-service";
import type { ArticleJobRecordRepository } from "./job-intake";
import type { ArticleJobQuotaGateway } from "./quota";

function createRecordRepository(
  overrides: Partial<ArticleJobRecordRepository> = {},
): ArticleJobRecordRepository {
  return {
    findPendingOrProcessingJobs: async () => [],
    insertArticleJob: async () => undefined,
    updateArticleJobMetadata: async () => undefined,
    deleteArticleJob: async () => undefined,
    ...overrides,
  };
}

function createQuotaGateway(
  overrides: Partial<ArticleJobQuotaGateway> = {},
): ArticleJobQuotaGateway {
  return {
    reserveArticle: async () => ({
      success: true,
      reservationId: "reservation-1",
      availableArticles: 9,
      totalReserved: 1,
      status: "reserved",
    }),
    releaseArticle: async () => true,
    ...overrides,
  };
}

const intakeItem = {
  keyword: "seo",
  title: "SEO",
  metadata: {
    mode: "single",
    title: "SEO",
    industry: null,
    region: null,
    language: null,
    competitors: [],
    writing_style: null,
  },
};

describe("createArticleJobIntakeService", () => {
  it("skips duplicate pending jobs without insert, reserve, or dispatch", async () => {
    const insertArticleJob = vi.fn();
    const reserveArticle = vi.fn();
    const dispatchJobs = vi.fn();
    const service = createArticleJobIntakeService({
      recordRepository: createRecordRepository({
        findPendingOrProcessingJobs: async () => [
          {
            id: "existing-job",
            status: "pending",
            keywords: ["seo"],
          },
        ],
        insertArticleJob,
      }),
      quotaGateway: createQuotaGateway({ reserveArticle }),
      dispatchJobs,
      createJobId: () => "job-1",
    });

    const result = await service.createJobs({
      userId: "user-1",
      companyId: "company-1",
      websiteId: null,
      items: [intakeItem],
    });

    expect(result).toMatchObject({
      success: true,
      skippedJobs: [
        {
          id: "existing-job",
          keyword: "seo",
          reason: "duplicate_pending_job",
        },
      ],
      counts: {
        created: 0,
        skipped: 1,
        failed: 0,
      },
      dispatch: {
        attempted: false,
        status: "not_needed",
      },
    });
    expect(insertArticleJob).not.toHaveBeenCalled();
    expect(reserveArticle).not.toHaveBeenCalled();
    expect(dispatchJobs).not.toHaveBeenCalled();
  });

  it("inserts, reserves, and dispatches new runnable jobs", async () => {
    const insertArticleJob = vi.fn(async () => undefined);
    const reserveArticle = vi.fn(async () => ({
      success: true as const,
      reservationId: "reservation-1",
      availableArticles: 4,
      totalReserved: 1,
      status: "reserved" as const,
    }));
    const dispatchJobs = vi.fn(async () => ({
      attempted: true as const,
      status: "triggered" as const,
    }));
    const service = createArticleJobIntakeService({
      recordRepository: createRecordRepository({ insertArticleJob }),
      quotaGateway: createQuotaGateway({ reserveArticle }),
      dispatchJobs,
      createJobId: () => "job-1",
    });

    const result = await service.createJobs({
      userId: "user-1",
      companyId: "company-1",
      websiteId: "website-1",
      items: [intakeItem],
    });

    expect(insertArticleJob).toHaveBeenCalledWith({
      id: "job-1",
      jobId: "job-1",
      companyId: "company-1",
      websiteId: "website-1",
      userId: "user-1",
      keywords: ["seo"],
      status: "pending",
      metadata: intakeItem.metadata,
    });
    expect(reserveArticle).toHaveBeenCalledWith({
      companyId: "company-1",
      jobId: "job-1",
    });
    expect(dispatchJobs).toHaveBeenCalledWith(["job-1"]);
    expect(result).toMatchObject({
      success: true,
      createdJobs: [
        {
          id: "job-1",
          keyword: "seo",
          title: "SEO",
          reservationStatus: "reserved",
        },
      ],
      quota: {
        requiredArticles: 1,
        reservedArticles: 1,
        availableArticles: 4,
      },
      dispatch: {
        attempted: true,
        status: "triggered",
      },
    });
  });

  it("records insert failures and does not reserve or dispatch", async () => {
    const reserveArticle = vi.fn();
    const dispatchJobs = vi.fn();
    const service = createArticleJobIntakeService({
      recordRepository: createRecordRepository({
        insertArticleJob: async () => {
          throw new Error("insert failed");
        },
      }),
      quotaGateway: createQuotaGateway({ reserveArticle }),
      dispatchJobs,
      createJobId: () => "job-1",
    });

    const result = await service.createJobs({
      userId: "user-1",
      companyId: "company-1",
      websiteId: null,
      items: [intakeItem],
    });

    expect(result.success).toBe(false);
    expect(result.failedItems).toEqual([
      {
        keyword: "seo",
        reason: "job_insert_failed",
        message: "insert failed",
      },
    ]);
    expect(reserveArticle).not.toHaveBeenCalled();
    expect(dispatchJobs).not.toHaveBeenCalled();
  });

  it("cleans up inserted jobs when reservation fails", async () => {
    const deleteArticleJob = vi.fn(async () => undefined);
    const dispatchJobs = vi.fn();
    const service = createArticleJobIntakeService({
      recordRepository: createRecordRepository({
        deleteArticleJob,
      }),
      quotaGateway: createQuotaGateway({
        reserveArticle: async () => ({
          success: false,
          reason: "insufficient_quota",
          availableArticles: 0,
          totalReserved: 0,
          message: "額度不足",
          status: "failed",
        }),
      }),
      dispatchJobs,
      createJobId: () => "job-1",
    });

    const result = await service.createJobs({
      userId: "user-1",
      companyId: "company-1",
      websiteId: null,
      items: [intakeItem],
    });

    expect(deleteArticleJob).toHaveBeenCalledWith("job-1");
    expect(result.failedItems).toEqual([
      {
        keyword: "seo",
        reason: "insufficient_quota",
        message: "額度不足",
      },
    ]);
    expect(result.createdJobs).toEqual([]);
    expect(dispatchJobs).not.toHaveBeenCalled();
  });

  it("updates metadata and dispatches when competitor analysis is allowed", async () => {
    const updateArticleJobMetadata = vi.fn(async () => undefined);
    const analyzeCompetitors = vi.fn(async () => ({
      allowed: true,
      results: [{ content: "strategy", provider: "perplexity" }],
    }));
    const dispatchJobs = vi.fn(async () => ({
      attempted: true as const,
      status: "triggered" as const,
    }));
    const service = createArticleJobIntakeService({
      recordRepository: createRecordRepository({ updateArticleJobMetadata }),
      quotaGateway: createQuotaGateway(),
      createCompetitorAnalysisRunner: () => ({
        analyzeCompetitors,
      }),
      dispatchJobs,
      createJobId: () => "job-1",
    });

    const result = await service.createJobs({
      userId: "user-1",
      companyId: "company-1",
      websiteId: null,
      items: [
        {
          ...intakeItem,
          metadata: {
            ...intakeItem.metadata,
            competitors: ["https://example.com"],
          },
        },
      ],
    });

    expect(analyzeCompetitors).toHaveBeenCalledWith(["https://example.com"]);
    expect(updateArticleJobMetadata).toHaveBeenCalledWith("job-1", {
      ...intakeItem.metadata,
      competitors: ["https://example.com"],
      competitorAnalysis: [{ content: "strategy", provider: "perplexity" }],
    });
    expect(dispatchJobs).toHaveBeenCalledWith(["job-1"]);
    expect(result).toMatchObject({
      success: true,
      createdJobs: [
        {
          id: "job-1",
          reservationStatus: "reserved",
        },
      ],
      quota: {
        reservedArticles: 1,
      },
    });
  });

  it("releases article reservation and deletes job when competitor quota is denied", async () => {
    const deleteArticleJob = vi.fn(async () => undefined);
    const releaseArticle = vi.fn(async () => true);
    const dispatchJobs = vi.fn();
    const service = createArticleJobIntakeService({
      recordRepository: createRecordRepository({ deleteArticleJob }),
      quotaGateway: createQuotaGateway({ releaseArticle }),
      createCompetitorAnalysisRunner: () => ({
        analyzeCompetitors: async () => ({
          allowed: false,
          message: "配額不足",
        }),
      }),
      dispatchJobs,
      createJobId: () => "job-1",
    });

    const result = await service.createJobs({
      userId: "user-1",
      companyId: "company-1",
      websiteId: null,
      items: [
        {
          ...intakeItem,
          metadata: {
            ...intakeItem.metadata,
            competitors: ["https://example.com"],
          },
        },
      ],
    });

    expect(releaseArticle).toHaveBeenCalledWith("job-1");
    expect(deleteArticleJob).toHaveBeenCalledWith("job-1");
    expect(result).toMatchObject({
      success: false,
      createdJobs: [],
      failedItems: [
        {
          keyword: "seo",
          reason: "competitor_quota_exceeded",
          message: "配額不足",
        },
      ],
      quota: {
        reservedArticles: 0,
      },
      dispatch: {
        attempted: false,
        status: "not_needed",
      },
    });
    expect(dispatchJobs).not.toHaveBeenCalled();
  });
});
