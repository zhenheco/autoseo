import { getUser, getUserCompanies } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  checkPagePermission,
  getUserSubscriptionTier,
} from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  await checkPagePermission("canAccessDashboard");

  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const companies = await getUserCompanies(user.id);
  const subscriptionTier = await getUserSubscriptionTier();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  let tokenBalance = 0;
  let articlesCount = 0;
  let websitesCount = 0;

  if (membership) {
    // 並行執行所有查詢，提升頁面載入速度
    const [subscriptionResult, articlesResult, websitesResult] =
      await Promise.all([
        supabase
          .from("company_subscriptions")
          .select(
            "monthly_quota_balance, purchased_token_balance, monthly_token_quota",
          )
          .eq("company_id", membership.company_id)
          .eq("status", "active")
          .single(),
        supabase
          .from("generated_articles")
          .select("*", { count: "exact", head: true })
          .eq("company_id", membership.company_id),
        supabase
          .from("website_configs")
          .select("*", { count: "exact", head: true })
          .eq("company_id", membership.company_id)
          .eq("is_active", true),
      ]);

    const subscription = subscriptionResult.data;
    if (subscription) {
      const isFree = subscription.monthly_token_quota === 0;
      tokenBalance = isFree
        ? subscription.purchased_token_balance
        : subscription.monthly_quota_balance +
          subscription.purchased_token_balance;
    }

    articlesCount = articlesResult.count || 0;
    websitesCount = websitesResult.count || 0;
  }

  return (
    <DashboardClient
      userEmail={user.email || ""}
      articlesCount={articlesCount}
      websitesCount={websitesCount}
      subscriptionTier={subscriptionTier || "free"}
      tokenBalance={tokenBalance}
    />
  );
}
