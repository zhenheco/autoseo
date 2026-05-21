import { describe, expect, it } from "vitest";
import {
  buildArticleJobIntakeResult,
  hasRunnableArticleJobs,
  normalizeBatchArticleGenerationInput,
  normalizeSingleArticleGenerationInput,
  splitDuplicateArticleJobItems,
  resolveArticleJobBillingAccount,
  type ArticleJobCompanyRepository,
  resolveArticleJobWebsite,
  type ArticleJobWebsiteRepository,
} from "../job-intake";

function createCompanyRepository(
  overrides: Partial<ArticleJobCompanyRepository> = {},
): ArticleJobCompanyRepository {
  return {
    findActiveMembershipCompanyId: async () => null,
    companyExists: async () => false,
    findOwnedCompanyId: async () => null,
    createPersonalCompany: async () => "created-company",
    upsertOwnerMembership: async () => undefined,
    ...overrides,
  };
}

function createWebsiteRepository(
  overrides: Partial<ArticleJobWebsiteRepository> = {},
): ArticleJobWebsiteRepository {
  return {
    findFirstWebsiteId: async () => null,
    createDefaultWebsite: async () => "website-created",
    createDefaultAgentConfig: async () => undefined,
    ...overrides,
  };
}

describe("ArticleJobIntake result contract", () => {
  it("summarizes created, skipped, failed, quota, and dispatch state", () => {
    const result = buildArticleJobIntakeResult({
      createdJobs: [
        {
          id: "job-1",
          keyword: "seo agency",
          title: "SEO Agency Guide",
          reservationStatus: "reserved",
        },
      ],
      skippedJobs: [
        {
          id: "job-2",
          keyword: "content marketing",
          reason: "duplicate_pending_job",
        },
      ],
      failedItems: [
        {
          keyword: "broken",
          reason: "quota_reservation_failed",
          message: "Quota reservation failed",
        },
      ],
      quota: {
        requiredArticles: 2,
        reservedArticles: 1,
        availableArticles: 3,
      },
      dispatch: {
        attempted: true,
        status: "failed",
        message: "GitHub dispatch failed; scheduler fallback remains active",
      },
    });

    expect(result.success).toBe(false);
    expect(result.counts).toEqual({
      created: 1,
      skipped: 1,
      failed: 1,
    });
    expect(result.quota.reservedArticles).toBe(1);
    expect(result.dispatch.status).toBe("failed");
    expect(hasRunnableArticleJobs(result)).toBe(true);
  });

  it("does not consider unreserved jobs runnable", () => {
    const result = buildArticleJobIntakeResult({
      createdJobs: [
        {
          id: "job-1",
          keyword: "seo agency",
          title: "SEO Agency Guide",
          reservationStatus: "failed",
        },
      ],
      skippedJobs: [],
      failedItems: [],
      quota: {
        requiredArticles: 1,
        reservedArticles: 0,
        availableArticles: 1,
      },
      dispatch: {
        attempted: false,
        status: "not_needed",
      },
    });

    expect(result.success).toBe(true);
    expect(hasRunnableArticleJobs(result)).toBe(false);
  });

  it("normalizes legacy single article generation payloads", () => {
    const result = normalizeSingleArticleGenerationInput({
      keyword: "SEO 顧問",
      mode: "single",
      website_id: null,
      writing_style: "case-study",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.data).toEqual({
      items: [
        {
          keyword: "SEO 顧問",
          title: "SEO 顧問",
          metadata: {
            mode: "single",
            title: "SEO 顧問",
            industry: null,
            region: null,
            language: null,
            competitors: [],
            writing_style: "case-study",
          },
        },
      ],
      websiteId: null,
      hasWebsiteIdField: true,
    });
  });

  it("normalizes strategy-based single article generation payloads", () => {
    const result = normalizeSingleArticleGenerationInput({
      industry: "牙醫",
      region: "台北",
      language: "zh-TW",
      competitors: ["https://example.com"],
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.data?.items[0]).toMatchObject({
      keyword: "牙醫",
      title: "牙醫",
      metadata: {
        industry: "牙醫",
        region: "台北",
        language: "zh-TW",
        competitors: ["https://example.com"],
      },
    });
    expect(result.data?.hasWebsiteIdField).toBe(false);
  });

  it("rejects partial strategy-based single article generation payloads", () => {
    const result = normalizeSingleArticleGenerationInput({
      industry: "牙醫",
      language: "zh-TW",
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation failure");
    }
    expect(result.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Industry, region, and language are required together",
    });
  });

  it("normalizes batch item payloads", () => {
    const result = normalizeBatchArticleGenerationInput({
      items: [
        { keyword: "SEO 顧問", title: "SEO 顧問完整指南" },
        { keyword: "內容行銷" },
      ],
      options: {
        targetLanguage: "zh-TW",
        region: "台灣",
        industry: "B2B SaaS",
        wordCount: "1800",
      },
      writing_style: "expert",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.data.hasWebsiteIdField).toBe(false);
    expect(result.data.items).toHaveLength(2);
    expect(result.data.items[0]).toMatchObject({
      keyword: "SEO 顧問",
      title: "SEO 顧問完整指南",
      metadata: {
        mode: "batch",
        title: "SEO 顧問完整指南",
        batchIndex: 0,
        totalBatch: 2,
        targetLanguage: "zh-TW",
        region: "台灣",
        industry: "B2B SaaS",
        wordCount: "1800",
        writing_style: "expert",
      },
    });
    expect(result.data.items[1]).toMatchObject({
      keyword: "內容行銷",
      title: "內容行銷",
      metadata: {
        batchIndex: 1,
      },
    });
  });

  it("normalizes legacy batch keyword arrays", () => {
    const result = normalizeBatchArticleGenerationInput({
      keywords: ["SEO 顧問", "內容行銷"],
      website_id: "website-1",
      targetLanguage: "en-US",
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.data.websiteId).toBe("website-1");
    expect(result.data.hasWebsiteIdField).toBe(true);
    expect(result.data.items.map((item) => item.keyword)).toEqual([
      "SEO 顧問",
      "內容行銷",
    ]);
    expect(result.data.items[0].metadata.targetLanguage).toBe("en-US");
  });

  it("rejects empty batch payloads", () => {
    const result = normalizeBatchArticleGenerationInput({
      keywords: [],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation failure");
    }
    expect(result.error.message).toBe("Items or keywords array is required");
  });

  it("rejects batch keywords over 500 characters", () => {
    const result = normalizeBatchArticleGenerationInput({
      keywords: ["x".repeat(501)],
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected validation failure");
    }
    expect(result.error.message).toBe(
      "Keyword length cannot exceed 500 characters",
    );
  });

  it("resolves an active membership company when the company exists", async () => {
    const result = await resolveArticleJobBillingAccount({
      user: { id: "user-1", email: "owner@example.com" },
      policy: "fallback_to_user_id",
      repository: createCompanyRepository({
        findActiveMembershipCompanyId: async () => "company-1",
        companyExists: async () => true,
      }),
    });

    expect(result).toEqual({
      billingId: "company-1",
      source: "active_membership",
      membershipUpserted: false,
    });
  });

  it("falls back to user id for single generation when no company exists", async () => {
    const result = await resolveArticleJobBillingAccount({
      user: { id: "user-1", email: "owner@example.com" },
      policy: "fallback_to_user_id",
      repository: createCompanyRepository(),
    });

    expect(result).toEqual({
      billingId: "user-1",
      source: "user_id_fallback",
      membershipUpserted: false,
    });
  });

  it("uses an existing owner company when batch generation must ensure a company", async () => {
    const upserts: Array<{ companyId: string; userId: string }> = [];

    const result = await resolveArticleJobBillingAccount({
      user: { id: "user-1", email: "owner@example.com" },
      policy: "ensure_personal_company",
      repository: createCompanyRepository({
        findOwnedCompanyId: async () => "owned-company",
        upsertOwnerMembership: async (input) => {
          upserts.push(input);
        },
      }),
    });

    expect(result).toEqual({
      billingId: "owned-company",
      source: "owned_company",
      membershipUpserted: true,
    });
    expect(upserts).toEqual([{ companyId: "owned-company", userId: "user-1" }]);
  });

  it("creates a personal company when batch generation has no company", async () => {
    const created: Array<{ userId: string; name: string; slug: string }> = [];

    const result = await resolveArticleJobBillingAccount({
      user: { id: "user-1", email: "owner@example.com" },
      policy: "ensure_personal_company",
      slugSuffix: "fixed",
      repository: createCompanyRepository({
        createPersonalCompany: async (input) => {
          created.push(input);
          return "created-company";
        },
      }),
    });

    expect(result).toEqual({
      billingId: "created-company",
      source: "created_personal_company",
      membershipUpserted: true,
    });
    expect(created).toEqual([
      {
        userId: "user-1",
        name: "owner",
        slug: "owner-fixed",
      },
    ]);
  });

  it("uses explicit website id when caller provides one", async () => {
    const result = await resolveArticleJobWebsite({
      billingId: "company-1",
      requestedWebsiteId: "website-1",
      hasWebsiteIdField: true,
      policy: "select_existing_or_none",
      repository: createWebsiteRepository(),
    });

    expect(result).toEqual({
      websiteId: "website-1",
      source: "explicit",
      createdDefaultWebsite: false,
    });
  });

  it("respects explicit null website selection", async () => {
    const result = await resolveArticleJobWebsite({
      billingId: "company-1",
      requestedWebsiteId: null,
      hasWebsiteIdField: true,
      policy: "ensure_default",
      repository: createWebsiteRepository({
        findFirstWebsiteId: async () => "should-not-query",
      }),
    });

    expect(result).toEqual({
      websiteId: null,
      source: "explicit_none",
      createdDefaultWebsite: false,
    });
  });

  it("selects existing website when website field is omitted", async () => {
    const result = await resolveArticleJobWebsite({
      billingId: "company-1",
      requestedWebsiteId: null,
      hasWebsiteIdField: false,
      policy: "select_existing_or_none",
      repository: createWebsiteRepository({
        findFirstWebsiteId: async () => "website-1",
      }),
    });

    expect(result).toEqual({
      websiteId: "website-1",
      source: "first_existing",
      createdDefaultWebsite: false,
    });
  });

  it("creates default website and agent config when batch policy requires one", async () => {
    const agentConfigs: string[] = [];

    const result = await resolveArticleJobWebsite({
      billingId: "company-1",
      requestedWebsiteId: null,
      hasWebsiteIdField: false,
      policy: "ensure_default",
      repository: createWebsiteRepository({
        createDefaultWebsite: async () => "website-created",
        createDefaultAgentConfig: async (websiteId) => {
          agentConfigs.push(websiteId);
        },
      }),
    });

    expect(result).toEqual({
      websiteId: "website-created",
      source: "created_default",
      createdDefaultWebsite: true,
    });
    expect(agentConfigs).toEqual(["website-created"]);
  });

  it("splits duplicate pending article jobs from new intake items", () => {
    const result = splitDuplicateArticleJobItems({
      items: [
        {
          keyword: "SEO 顧問",
          title: "SEO 顧問",
          metadata: {
            mode: "batch",
            title: "SEO 顧問",
            industry: null,
            region: null,
            language: null,
            competitors: [],
            writing_style: null,
          },
        },
        {
          keyword: "內容行銷",
          title: "內容行銷",
          metadata: {
            mode: "batch",
            title: "內容行銷",
            industry: null,
            region: null,
            language: null,
            competitors: [],
            writing_style: null,
          },
        },
      ],
      existingJobsByKeyword: new Map([
        [
          "SEO 顧問",
          {
            id: "job-existing",
            status: "processing",
          },
        ],
      ]),
    });

    expect(result.newItems.map((item) => item.keyword)).toEqual(["內容行銷"]);
    expect(result.skippedJobs).toEqual([
      {
        id: "job-existing",
        keyword: "SEO 顧問",
        reason: "duplicate_processing_job",
      },
    ]);
  });
});
