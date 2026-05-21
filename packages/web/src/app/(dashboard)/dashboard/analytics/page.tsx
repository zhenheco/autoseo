import { getUser } from "@shared/auth";
import { checkPagePermission } from "@shared/auth/permissions";
import { createClient } from "@shared/supabase";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./analytics-client";
import { resolveActiveBrandFromCandidates } from "@/lib/brands/active-brand";
import {
  buildCurrentDashboardRequest,
  fetchBrandsFromApi,
} from "@/lib/brands/server-api";

export const dynamic = "force-dynamic";

type SubscriptionSelection = {
  subscription_plans:
    | {
        slug: string | null;
      }
    | Array<{
        slug: string | null;
      }>
    | null;
};

function getPlanSlug(
  subscriptionPlans: SubscriptionSelection["subscription_plans"],
) {
  if (Array.isArray(subscriptionPlans)) {
    return subscriptionPlans[0]?.slug ?? "free";
  }

  return subscriptionPlans?.slug ?? "free";
}

async function loadInitialPlan(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("subscription_plans(slug)")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.warn("[AnalyticsPage] Failed to load plan:", error);
    return "free";
  }

  return data
    ? getPlanSlug((data as SubscriptionSelection).subscription_plans)
    : "free";
}

export default async function AnalyticsPage() {
  await checkPagePermission("canAccessDashboard");

  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const brands = await fetchBrandsFromApi();
  const activeBrand = resolveActiveBrandFromCandidates(
    await buildCurrentDashboardRequest(),
    brands,
  );

  if (!activeBrand) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a brand before viewing analytics.
        </p>
      </div>
    );
  }

  const initialPlan = await loadInitialPlan(activeBrand.company_id);

  return (
    <AnalyticsClient
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
      activeBrandId={activeBrand.id}
      initialPlan={initialPlan}
    />
  );
}
