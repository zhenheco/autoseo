import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionPlans } from "./subscription-plans";
import { TokenPackages } from "./token-packages";
import { PaymentHistory } from "./payment-history";
import { SubscriptionStatusChecker } from "@/components/subscription/SubscriptionStatusChecker";
import type { Database } from "@/types/database.types";
import { checkPagePermission } from "@/lib/permissions";
import { getTranslations } from "next-intl/server";

export default async function SubscriptionPage() {
  await checkPagePermission("canAccessSubscription");

  const t = await getTranslations("subscription");
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: members } = await supabase
    .from("company_members")
    .select("company_id, role, status")
    .eq("user_id", user.id);

  if (!members || members.length === 0) {
    redirect("/dashboard");
  }

  const activeMember = members.find((m) => m.status === "active");
  const member = activeMember || members[0];

  const { data: company } = await supabase
    .from("companies")
    .select<"*", Database["public"]["Tables"]["companies"]["Row"]>("*")
    .eq("id", member.company_id)
    .single();

  // 從 company_subscriptions 表讀取訂閱資訊（包含 plan 資訊和疊加購買資訊）
  const { data: companySubscription } = await supabase
    .from("company_subscriptions")
    .select(
      "plan_id, monthly_quota_balance, purchased_token_balance, monthly_token_quota, base_monthly_quota, purchased_count, current_period_end, is_lifetime, subscription_plans(name, slug)",
    )
    .eq("company_id", member.company_id)
    .eq("status", "active")
    .single();

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select<"*", Database["public"]["Tables"]["subscription_plans"]["Row"]>("*")
    .eq("is_lifetime", true)
    .neq("slug", "free")
    .order("lifetime_price", { ascending: true });

  const { data: tokenPackages } = await supabase
    .from("token_packages")
    .select<"*", Database["public"]["Tables"]["token_packages"]["Row"]>("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  const { data: paymentOrders } = await supabase
    .from("payment_orders")
    .select<"*", Database["public"]["Tables"]["payment_orders"]["Row"]>("*")
    .eq("company_id", member.company_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="container mx-auto p-8">
      <SubscriptionStatusChecker />

      {company && (
        <div className="mb-8 p-6 rounded-lg bg-gradient-to-br from-card to-muted border border-border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{t("currentPlan")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("planType")}
              </p>
              <p className="text-lg font-semibold">
                {(
                  companySubscription?.subscription_plans as {
                    name?: string;
                  } | null
                )?.name ||
                  (company.subscription_tier === "free"
                    ? t("freePlan")
                    : t("unknownPlan"))}
                {(companySubscription?.purchased_count || 1) > 1 && (
                  <span className="ml-2 text-sm text-purple-600">
                    (x{companySubscription?.purchased_count})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("monthlyResetCredits")}
              </p>
              <p className="text-lg font-semibold">
                {companySubscription?.monthly_token_quota?.toLocaleString() ||
                  0}
              </p>
              {(companySubscription?.purchased_count || 1) > 1 && (
                <p className="text-xs text-muted-foreground">
                  {t("base")}{" "}
                  {companySubscription?.base_monthly_quota?.toLocaleString()} x{" "}
                  {companySubscription?.purchased_count}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("purchasedCredits")}
              </p>
              <p className="text-lg font-semibold">
                {companySubscription?.purchased_token_balance?.toLocaleString() ||
                  0}
              </p>
              <p className="text-xs text-success mt-1">{t("neverExpires")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("quotaResetDate")}
              </p>
              <p className="text-lg font-semibold">
                {companySubscription?.current_period_end
                  ? new Date(
                      companySubscription.current_period_end,
                    ).toLocaleDateString("zh-TW", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div id="plans" className="mb-12">
        <SubscriptionPlans
          plans={plans || []}
          companyId={member.company_id}
          userEmail={user.email || ""}
          currentTier={company?.subscription_tier || "free"}
          currentSubscription={
            companySubscription
              ? {
                  plan_id: companySubscription.plan_id,
                  purchased_count: companySubscription.purchased_count || 1,
                  base_monthly_quota:
                    companySubscription.base_monthly_quota ||
                    companySubscription.monthly_token_quota ||
                    0,
                  monthly_token_quota:
                    companySubscription.monthly_token_quota || 0,
                }
              : null
          }
        />
      </div>

      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">
          {t("creditPackagePurchase")}
        </h2>
        <TokenPackages
          packages={tokenPackages || []}
          companyId={member.company_id}
          userEmail={user.email || ""}
        />
      </div>

      <PaymentHistory orders={paymentOrders || []} />
    </div>
  );
}
