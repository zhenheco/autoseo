import { describe, expect, it, vi } from "vitest";
import { createArticleJobGenerationService } from "./generation-service";
import type {
  ArticleJobCompanyRepository,
  ArticleJobInputNormalizationResult,
  ArticleJobWebsiteRepository,
} from "./job-intake";
import type { ArticleJobIntakeService } from "./intake-service";
import type { ArticleJobSubscriptionRepository } from "./subscription";

function createCompanyRepository(
  overrides: Partial<ArticleJobCompanyRepository> = {},
): ArticleJobCompanyRepository {
  return {
    findActiveMembershipCompanyId: async () => null,
    companyExists: async () => false,
    findOwnedCompanyId: async () => null,
    createPersonalCompany: async () => "company-1",
    upsertOwnerMembership: async () => undefined,
    ...overrides,
  };
}

function createWebsiteRepository(
  overrides: Partial<ArticleJobWebsiteRepository> = {},
): ArticleJobWebsiteRepository {
  return {
    findFirstWebsiteId: async () => null,
    createDefaultWebsite: async () => "website-1",
    createDefaultAgentConfig: async () => undefined,
    ...overrides,
  };
}

function createSubscriptionRepository(
  overrides: Partial<ArticleJobSubscriptionRepository> = {},
): ArticleJobSubscriptionRepository {
  return {
    findActiveSubscription: async () => ({
      id: "subscription-1",
      status: "active",
    }),
    ...overrides,
  };
}

function createIntakeService(
  overrides: Partial<ArticleJobIntakeService> = {},
): ArticleJobIntakeService {
  return {
    createJobs: async () => ({
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
    }),
    ...overrides,
  };
}

const normalizedInput: Extract<
  ArticleJobInputNormalizationResult,
  { success: true }
>["data"] = {
  websiteId: null,
  hasWebsiteIdField: false,
  items: [
    {
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
    },
  ],
};

describe("createArticleJobGenerationService", () => {
  it("resolves billing and website before creating intake jobs", async () => {
    const createJobs = vi.fn(async () => ({
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
        attempted: false as const,
        status: "not_needed" as const,
      },
    }));
    const service = createArticleJobGenerationService({
      companyRepository: createCompanyRepository({
        findActiveMembershipCompanyId: async () => "company-1",
        companyExists: async () => true,
      }),
      subscriptionRepository: createSubscriptionRepository(),
      websiteRepository: createWebsiteRepository({
        findFirstWebsiteId: async () => "website-1",
      }),
      intakeService: createIntakeService({ createJobs }),
    });

    await service.createArticleJobs({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      input: normalizedInput,
      billingPolicy: "fallback_to_user_id",
      websitePolicy: "select_existing_or_none",
    });

    expect(createJobs).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "company-1",
      websiteId: "website-1",
      items: normalizedInput.items,
    });
  });

  it("respects explicit null website selection", async () => {
    const createJobs = vi.fn(createIntakeService().createJobs);
    const service = createArticleJobGenerationService({
      companyRepository: createCompanyRepository({
        findActiveMembershipCompanyId: async () => "company-1",
        companyExists: async () => true,
      }),
      subscriptionRepository: createSubscriptionRepository(),
      websiteRepository: createWebsiteRepository({
        findFirstWebsiteId: async () => "website-should-not-be-used",
      }),
      intakeService: createIntakeService({ createJobs }),
    });

    await service.createArticleJobs({
      user: {
        id: "user-1",
      },
      input: {
        ...normalizedInput,
        websiteId: null,
        hasWebsiteIdField: true,
      },
      billingPolicy: "fallback_to_user_id",
      websitePolicy: "select_existing_or_none",
    });

    expect(createJobs).toHaveBeenCalledWith(
      expect.objectContaining({
        websiteId: null,
      }),
    );
  });

  it("stops before website resolution and intake when subscription is missing", async () => {
    const findFirstWebsiteId = vi.fn(async () => "website-1");
    const createJobs = vi.fn(createIntakeService().createJobs);
    const service = createArticleJobGenerationService({
      companyRepository: createCompanyRepository({
        findActiveMembershipCompanyId: async () => "company-1",
        companyExists: async () => true,
      }),
      subscriptionRepository: createSubscriptionRepository({
        findActiveSubscription: async () => null,
      }),
      websiteRepository: createWebsiteRepository({
        findFirstWebsiteId,
      }),
      intakeService: createIntakeService({ createJobs }),
    });

    const result = await service.createArticleJobs({
      user: {
        id: "user-1",
      },
      input: normalizedInput,
      billingPolicy: "fallback_to_user_id",
      websitePolicy: "select_existing_or_none",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "NO_ACTIVE_SUBSCRIPTION",
        message: "找不到有效的訂閱，請聯絡客服信箱處理",
      },
    });
    expect(findFirstWebsiteId).not.toHaveBeenCalled();
    expect(createJobs).not.toHaveBeenCalled();
  });
});
