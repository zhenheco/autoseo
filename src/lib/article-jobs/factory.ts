import { createSearchRouter } from "@/lib/search/search-router";
import { dispatchArticleJobs } from "./dispatch";
import { createArticleJobGenerationService } from "./generation-service";
import { createArticleJobIntakeService } from "./intake-service";
import { createArticleJobQuotaGateway } from "./quota";
import {
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
}

export function createSupabaseArticleJobGenerationService({
  supabase,
  quotaService,
  github,
  createJobId,
  dispatchTimeoutMs,
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
    intakeService,
  });
}
