import { getUser } from "@shared/auth";
import { checkPagePermission } from "@shared/auth/permissions";
import { createClient } from "@shared/supabase";
import { redirect } from "next/navigation";
import { resolveActiveBrandFromCandidates } from "@/lib/brands/active-brand";
import {
  buildCurrentDashboardRequest,
  fetchBrandsFromApi,
} from "@/lib/brands/server-api";
import { resolveQuotaPlan } from "@/lib/quota/plan-resolver";
import type {
  SocialAccountStatus,
  SocialAccountView,
} from "./social-management-client";
import { SocialManagementClient } from "./social-management-client";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

type SocialAccountRow = Pick<
  Database["public"]["Tables"]["social_accounts"]["Row"],
  | "id"
  | "brand_id"
  | "platform"
  | "platform_username"
  | "token_expires_at"
  | "connected_at"
  | "disconnected_at"
>;

type LastPublishedRow = {
  social_account_id: string | null;
  published_at: string | null;
};

function accountStatus(row: SocialAccountRow): SocialAccountStatus {
  if (row.disconnected_at) return "disconnected";
  if (row.token_expires_at && Date.parse(row.token_expires_at) <= Date.now()) {
    return "token-expired";
  }
  return "connected";
}

async function loadSocialAccounts(
  brandId: string,
): Promise<SocialAccountRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_accounts")
    .select(
      "id, brand_id, platform, platform_username, token_expires_at, connected_at, disconnected_at",
    )
    .eq("brand_id", brandId)
    .order("connected_at", { ascending: false });

  if (error) {
    console.warn("[SocialPage] Failed to load social accounts:", error);
    return [];
  }

  return Array.isArray(data) ? (data as SocialAccountRow[]) : [];
}

async function loadLastPublishedByAccount(
  accountIds: string[],
): Promise<Map<string, string>> {
  if (accountIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_posts")
    .select("social_account_id, published_at")
    .in("social_account_id", accountIds)
    .eq("status", "published")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false });

  if (error) {
    console.warn(
      "[SocialPage] Failed to load last published timestamps:",
      error,
    );
    return new Map();
  }

  const lastPublished = new Map<string, string>();
  for (const row of (data ?? []) as LastPublishedRow[]) {
    if (
      row.social_account_id &&
      row.published_at &&
      !lastPublished.has(row.social_account_id)
    ) {
      lastPublished.set(row.social_account_id, row.published_at);
    }
  }

  return lastPublished;
}

async function loadConnectedCompanyAccountCount(
  brandIds: string[],
): Promise<number> {
  if (brandIds.length === 0) return 0;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id")
    .in("brand_id", brandIds)
    .is("disconnected_at", null);

  if (error) {
    console.warn(
      "[SocialPage] Failed to load company social account count:",
      error,
    );
    return 0;
  }

  return Array.isArray(data) ? data.length : 0;
}

export default async function SocialPage() {
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
        <h1 className="text-2xl font-semibold text-foreground">Social</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a brand before connecting social accounts.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const [plan, accountRows, companyConnectedCount] = await Promise.all([
    resolveQuotaPlan(supabase as never, activeBrand.company_id),
    loadSocialAccounts(activeBrand.id),
    loadConnectedCompanyAccountCount(brands.map((brand) => brand.id)),
  ]);
  const lastPublishedByAccount = await loadLastPublishedByAccount(
    accountRows.map((account) => account.id),
  );
  const accounts: SocialAccountView[] = accountRows.map((account) => ({
    id: account.id,
    platform: account.platform,
    platformUsername: account.platform_username,
    status: accountStatus(account),
    connectedAt: account.connected_at,
    disconnectedAt: account.disconnected_at,
    tokenExpiresAt: account.token_expires_at,
    lastPublishedAt: lastPublishedByAccount.get(account.id) ?? null,
  }));
  const activeBrandConnectedCount = accounts.filter(
    (account) => account.status !== "disconnected",
  ).length;

  return (
    <SocialManagementClient
      brands={brands.map((brand) => ({ id: brand.id, name: brand.name }))}
      activeBrandId={activeBrand.id}
      activeBrandName={activeBrand.name}
      initialAccounts={accounts}
      plan={plan}
      activeBrandConnectedCount={activeBrandConnectedCount}
      companyConnectedCount={companyConnectedCount}
      metaOAuthPublicEnabled={process.env.META_OAUTH_PUBLIC_ENABLED === "true"}
    />
  );
}
