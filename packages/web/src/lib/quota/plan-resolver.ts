import type { QuotaPlan } from "./enforcer";

type SupabasePlanResponse = {
  data?: unknown;
  error?: { message?: string } | null;
};

type SupabasePlanQuery = {
  select(columns: string): SupabasePlanQuery;
  eq(column: string, value: unknown): SupabasePlanQuery;
  maybeSingle<T>(): PromiseLike<{
    data?: T | null;
    error?: { message?: string } | null;
  }>;
};

export interface SupabasePlanClient {
  from(table: string): SupabasePlanQuery;
}

type CompanySubscriptionPlanSelection = {
  billing_cycle?: string | null;
  subscription_plans?:
    | { slug?: string | null }
    | Array<{ slug?: string | null }>
    | null;
};

export async function resolveQuotaPlan(
  supabase: SupabasePlanClient,
  companyId: string,
): Promise<QuotaPlan> {
  const { data, error } = (await supabase
    .from("company_subscriptions")
    .select("billing_cycle, subscription_plans(slug)")
    .eq("company_id", companyId)
    .maybeSingle()) as SupabasePlanResponse;

  if (error || !data) {
    if (error) {
      console.warn(
        "[Quota] Failed to resolve plan, defaulting to solo:",
        error,
      );
    }
    return "solo";
  }

  return normalizeQuotaPlan(data as CompanySubscriptionPlanSelection);
}

export function normalizeQuotaPlan(
  subscription: CompanySubscriptionPlanSelection,
): QuotaPlan {
  const rawPlans = subscription.subscription_plans;
  const slug = Array.isArray(rawPlans) ? rawPlans[0]?.slug : rawPlans?.slug;
  const normalized = slug?.toLowerCase() ?? "";

  return normalized.startsWith("pro") ? "pro" : "solo";
}
