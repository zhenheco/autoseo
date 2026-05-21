import { getUser, getUserPrimaryCompany } from "@shared/auth";
import { createClient } from "@shared/supabase";
import { redirect } from "next/navigation";
import {
  DEFAULT_BRAND_PLAN_ID,
  getBrandQuota,
  normalizeBrandPlanId,
} from "@/lib/brands/brand-quota";
import { fetchBrandsFromApi } from "@/lib/brands/server-api";
import type { Brand } from "@/lib/brands/active-brand";
import {
  BrandsListClient,
  type BrandListItem,
  type BrandQuotaSummary,
} from "./BrandsListClient";

export const dynamic = "force-dynamic";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type CompanySubscriptionSelection = {
  billing_cycle: "monthly" | "yearly" | null;
  subscription_plans:
    | {
        slug: string | null;
      }
    | Array<{
        slug: string | null;
      }>
    | null;
};

export default async function BrandsPage() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const company = await getUserPrimaryCompany(user.id);
  if (!company) {
    redirect("/dashboard/unauthorized");
  }

  const supabase = await createClient();
  const [brands, quota, websiteCounts] = await Promise.all([
    fetchBrandsFromApi(),
    loadBrandQuota(supabase, company.id),
    loadWebsiteCountsByBrand(supabase, company.id),
  ]);

  const items = brands.map((brand) => toBrandListItem(brand, websiteCounts));

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <BrandsListClient
        initialBrands={items}
        quota={{
          ...quota,
          used: brands.length,
        }}
      />
    </div>
  );
}

async function loadBrandQuota(
  supabase: SupabaseClient,
  companyId: string,
): Promise<BrandQuotaSummary> {
  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("billing_cycle, subscription_plans(slug)")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.error("[Brands] Failed to load quota plan:", error);
  }

  const subscription = data as CompanySubscriptionSelection | null;
  const planId = subscription
    ? normalizeBrandPlanId(
        getPlanSlug(subscription.subscription_plans),
        subscription.billing_cycle,
      )
    : DEFAULT_BRAND_PLAN_ID;

  return {
    used: 0,
    cap: getBrandQuota(planId),
    plan: planId.startsWith("pro") ? "Pro" : "Solo",
    upgradeUrl: "/dashboard/billing",
  };
}

async function loadWebsiteCountsByBrand(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("website_configs")
    .select("brand_id")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .not("brand_id", "is", null);

  if (error) {
    console.error("[Brands] Failed to load website counts:", error);
    return new Map();
  }

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ brand_id: string | null }>) {
    if (!row.brand_id) continue;
    counts.set(row.brand_id, (counts.get(row.brand_id) ?? 0) + 1);
  }
  return counts;
}

function getPlanSlug(
  subscriptionPlans: CompanySubscriptionSelection["subscription_plans"],
): string | null {
  if (Array.isArray(subscriptionPlans)) {
    return subscriptionPlans[0]?.slug ?? null;
  }

  return subscriptionPlans?.slug ?? null;
}

function toBrandListItem(
  brand: Brand,
  websiteCounts: Map<string, number>,
): BrandListItem {
  return {
    id: brand.id,
    name: brand.name,
    voiceTone: brand.voice_tone,
    valueProps: brand.value_props ?? [],
    isDefault: brand.is_default,
    createdAt: brand.created_at,
    websiteCount: websiteCounts.get(brand.id) ?? 0,
    socialAccountCount: null,
  };
}
