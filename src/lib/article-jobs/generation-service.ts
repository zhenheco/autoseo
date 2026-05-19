import {
  resolveArticleJobBillingAccount,
  resolveArticleJobWebsite,
  type ArticleJobBillingPolicy,
  type ArticleJobBillingUser,
  type ArticleJobCompanyRepository,
  type ArticleJobInputNormalizationResult,
  type ArticleJobWebsitePolicy,
  type ArticleJobWebsiteRepository,
} from "./job-intake";
import type { ArticleJobIntakeResult } from "./job-intake";
import type { ArticleJobIntakeService } from "./intake-service";
import {
  ensureActiveArticleJobSubscription,
  type ArticleJobSubscriptionGuardResult,
  type ArticleJobSubscriptionRepository,
} from "./subscription";

export interface ArticleJobGenerationServiceInput {
  user: ArticleJobBillingUser;
  input: Extract<ArticleJobInputNormalizationResult, { success: true }>["data"];
  billingPolicy: ArticleJobBillingPolicy;
  websitePolicy: ArticleJobWebsitePolicy;
  slugSuffix?: string;
}

export interface CreateArticleJobGenerationServiceInput {
  companyRepository: ArticleJobCompanyRepository;
  subscriptionRepository: ArticleJobSubscriptionRepository;
  websiteRepository: ArticleJobWebsiteRepository;
  intakeService: ArticleJobIntakeService;
}

export type ArticleJobGenerationResult =
  | ArticleJobIntakeResult
  | Extract<ArticleJobSubscriptionGuardResult, { success: false }>;

export function createArticleJobGenerationService({
  companyRepository,
  subscriptionRepository,
  websiteRepository,
  intakeService,
}: CreateArticleJobGenerationServiceInput) {
  return {
    async createArticleJobs({
      user,
      input,
      billingPolicy,
      websitePolicy,
      slugSuffix,
    }: ArticleJobGenerationServiceInput) {
      const billing = await resolveArticleJobBillingAccount({
        user,
        policy: billingPolicy,
        repository: companyRepository,
        slugSuffix,
      });
      const subscription = await ensureActiveArticleJobSubscription({
        billingId: billing.billingId,
        repository: subscriptionRepository,
      });

      if (!subscription.success) {
        return subscription;
      }

      const website = await resolveArticleJobWebsite({
        billingId: billing.billingId,
        requestedWebsiteId: input.websiteId,
        hasWebsiteIdField: input.hasWebsiteIdField,
        policy: websitePolicy,
        repository: websiteRepository,
      });

      return intakeService.createJobs({
        userId: user.id,
        companyId: billing.billingId,
        websiteId: website.websiteId,
        items: input.items,
      });
    },
  };
}
