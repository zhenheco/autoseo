const QUOTAS: Record<string, number> = {
  solo_monthly: 1,
  solo_yearly: 1,
  pro_monthly: 5,
  pro_yearly: 5,
};

export const DEFAULT_BRAND_PLAN_ID = "solo_monthly";

export function getBrandQuota(planId: string): number {
  return QUOTAS[planId] ?? QUOTAS[DEFAULT_BRAND_PLAN_ID];
}

export function normalizeBrandPlanId(
  slug: string | null | undefined,
  billingCycle: string | null | undefined,
): string {
  const normalizedSlug = slug?.toLowerCase();
  const normalizedBillingCycle =
    billingCycle === "yearly" || billingCycle === "monthly"
      ? billingCycle
      : "monthly";

  if (normalizedSlug && normalizedSlug in QUOTAS) {
    return normalizedSlug;
  }

  if (normalizedSlug === "solo" || normalizedSlug === "pro") {
    return `${normalizedSlug}_${normalizedBillingCycle}`;
  }

  return DEFAULT_BRAND_PLAN_ID;
}
