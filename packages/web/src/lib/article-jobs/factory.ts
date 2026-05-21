import { createSearchRouter } from "@/lib/search/search-router";
import { dispatchArticleJobs } from "./dispatch";
import { createArticleJobGenerationService } from "./generation-service";
import { createArticleJobIntakeService } from "./intake-service";
import { createArticleJobQuotaGateway } from "./quota";
import { createQuotaEnforcer, type QuotaEnforcer } from "@/lib/quota/enforcer";
import { resolveQuotaPlan } from "@/lib/quota/plan-resolver";
import {
  createSupabaseArticleJobBrandRepository,
  createSupabaseArticleJobCompanyRepository,
  createSupabaseArticleJobRecordRepository,
  createSupabaseArticleJobSubscriptionRepository,
  createSupabaseArticleJobWebsiteRepository,
} from "./supabase-repositories";

export interface CreateSupabaseArticleJobGenerationServiceInput {
  supabase: Parameters<typeof createSupabaseArticleJobCompanyRepository>[0];
  quotaService: Parameters<typeof createArticleJobQuotaGateway>[0];
  github: {
    token: string | null | undefined;
    owner: string | null | undefined;
    repo: string | null | undefined;
  };
  createJobId: () => string;
  dispatchTimeoutMs?: number;
  quotaEnforcer?: QuotaEnforcer;
}

export function createSupabaseArticleJobGenerationService({
  supabase,
  quotaService,
  github,
  createJobId,
  dispatchTimeoutMs,
  quotaEnforcer,
}: CreateSupabaseArticleJobGenerationServiceInput) {
  const recordRepository = createSupabaseArticleJobRecordRepository(supabase);
  const intakeService = createArticleJobIntakeService({
    recordRepository,
    quotaGateway: createArticleJobQuotaGateway(quotaService),
    createCompetitorAnalysisRunner: (companyId) =>
      createSearchRouter({
        companyId,
        enableCache: true,
      }),
    createJobId,
    dispatchJobs: (jobIds) =>
      dispatchArticleJobs({
        eventType: "article-jobs-created",
        jobIds,
        github,
        timeoutMs: dispatchTimeoutMs,
      }),
  });

  return createArticleJobGenerationService({
    companyRepository: createSupabaseArticleJobCompanyRepository(supabase),
    subscriptionRepository:
      createSupabaseArticleJobSubscriptionRepository(supabase),
    websiteRepository: createSupabaseArticleJobWebsiteRepository(supabase),
    brandRepository: createSupabaseArticleJobBrandRepository(supabase),
    quotaEnforcer:
      quotaEnforcer ??
      createQuotaEnforcer({
        supabase: supabase as never,
        resolvePlan: (companyId) =>
          resolveQuotaPlan(supabase as never, companyId),
      }),
    intakeService,
  });
}
