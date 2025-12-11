// ===== 篇數制計費系統（新） =====
export {
  ArticleQuotaService,
  createArticleQuotaService,
} from "./article-quota-service";

export type {
  ArticleQuotaBalance,
  QuotaCheckResult,
  DeductArticleResult,
  ReservationResult,
  SubscriptionPlan as ArticleSubscriptionPlan,
  ArticlePackage,
  UsageLog,
} from "./article-quota-service";

// ===== Token 制計費系統（舊，保留向下相容） =====
export { TokenCalculator } from "./token-calculator";
export { TokenBillingService } from "./token-billing-service";
export { SubscriptionService } from "./subscription-service";
export { ResellerService } from "./reseller-service";

export type {
  TokenUsage,
  TokenCalculationResult,
  ModelPricing,
} from "./token-calculator";

export type {
  BilledCompletionResult,
  TokenCheckResult,
} from "./token-billing-service";

export type {
  SubscriptionPlan,
  TokenSubscriptionPlan,
  CompanySubscription,
} from "./subscription-service";

export type { Reseller, Commission } from "./reseller-service";
