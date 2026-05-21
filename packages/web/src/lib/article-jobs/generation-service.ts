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
import type { ArticleJobBrandRepository } from "./supabase-repositories";
import {
  ensureActiveArticleJobSubscription,
  type ArticleJobSubscriptionGuardResult,
  type ArticleJobSubscriptionRepository,
} from "./subscription";
import type { QuotaEnforcer } from "@/lib/quota/enforcer";
import { BrandNotFoundError, QuotaExceededError } from "@/lib/quota/errors";

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
  brandRepository?: ArticleJobBrandRepository;
  quotaEnforcer?: QuotaEnforcer;
  intakeService: ArticleJobIntakeService;
}

export type ArticleJobGenerationResult =
  | ArticleJobIntakeResult
  | Extract<ArticleJobSubscriptionGuardResult, { success: false }>;

export function createArticleJobGenerationService({
  companyRepository,
  subscriptionRepository,
  websiteRepository,
  brandRepository,
  quotaEnforcer,
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

      const brandId = await resolveBrandId({
        companyId: billing.billingId,
        requestedBrandId: input.brandId,
        hasBrandIdField: input.hasBrandIdField,
        repository: brandRepository,
      });

      if (quotaEnforcer) {
        const quota = await quotaEnforcer.canConsume(
          billing.billingId,
          "articles",
          input.items.length,
        );

        if (!quota.allowed) {
          throw new QuotaExceededError({
            resource: "articles",
            used: quota.used,
            cap: quota.cap,
            plan: quota.plan,
          });
        }
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
        brandId,
        items: input.items,
      });
    },
  };
}

async function resolveBrandId(input: {
  companyId: string;
  requestedBrandId: string | null;
  hasBrandIdField: boolean;
  repository?: ArticleJobBrandRepository;
}): Promise<string> {
  if (!input.repository) {
    if (!input.requestedBrandId) {
      throw new BrandNotFoundError(input.requestedBrandId);
    }
    return input.requestedBrandId;
  }

  if (input.requestedBrandId) {
    const brandCompanyId = await input.repository.findBrandCompanyId(
      input.requestedBrandId,
    );

    if (brandCompanyId !== input.companyId) {
      throw new BrandNotFoundError(input.requestedBrandId);
    }

    return input.requestedBrandId;
  }

  if (!input.hasBrandIdField) {
    console.warn(
      "[ArticleJobs] Deprecated request without brandId; using company default brand",
    );
  }

  const defaultBrandId = await input.repository.findDefaultBrandId(
    input.companyId,
  );

  if (!defaultBrandId) {
    throw new BrandNotFoundError(null);
  }

  return defaultBrandId;
}
