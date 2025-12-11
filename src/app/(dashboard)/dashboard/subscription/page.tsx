import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionPlans } from "./subscription-plans";
import { ArticlePackages } from "./article-packages";
import { PaymentHistory } from "./payment-history";
import { SubscriptionStatusChecker } from "@/components/subscription/SubscriptionStatusChecker";
import type { Database } from "@/types/database.types";
import { checkPagePermission } from "@/lib/permissions";
import { getTranslations } from "next-intl/server";

/**
 * 篇數制方案資料類型
 */
interface ArticlePlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number | null;
  articles_per_month: number;
  yearly_bonus_months: number;
  features: unknown;
}

/**
 * 文章加購包資料類型
 */
interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

/**
 * 公司訂閱資訊（篇數制）
 */
interface CompanySubscription {
  plan_id: string;
  subscription_articles_remaining: number;
  purchased_articles_remaining: number;
  articles_per_month: number;
  billing_cycle: "monthly" | "yearly";
  current_period_start: string | null;
  current_period_end: string | null;
  last_quota_reset_at: string | null;
  subscription_plans: {
    name: string;
    slug: string;
  } | null;
}

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

  // 從 company_subscriptions 表讀取訂閱資訊（篇數制）
  const { data: companySubscriptionRaw } = await supabase
    .from("company_subscriptions")
    .select(
      `plan_id,
       subscription_articles_remaining,
       purchased_articles_remaining,
       articles_per_month,
       billing_cycle,
       current_period_start,
       current_period_end,
       last_quota_reset_at,
       subscription_plans(name, slug)`,
    )
    .eq("company_id", member.company_id)
    .eq("status", "active")
    .single();

  // 類型斷言：新欄位在 migration 後才會被識別
  const companySubscription =
    companySubscriptionRaw as unknown as CompanySubscription | null;

  // 取得訂閱方案（篇數制，排除免費方案）
  const { data: plansRaw } = await supabase
    .from("subscription_plans")
    .select("*")
    .neq("slug", "free")
    .order("monthly_price", { ascending: true });

  // 類型斷言：新欄位在 migration 後才會被識別
  const plans = (plansRaw || []) as unknown as ArticlePlan[];

  // 取得文章加購包
  const { data: articlePackagesRaw } = await (
    supabase.from("article_packages" as "companies") as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: boolean,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{ data: ArticlePackage[] | null }>;
        };
      };
    }
  )
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });

  const articlePackages = articlePackagesRaw || [];

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
                {companySubscription?.subscription_plans?.name ||
                  (company.subscription_tier === "free"
                    ? t("freePlan")
                    : t("unknownPlan"))}
              </p>
              {companySubscription?.billing_cycle && (
                <p className="text-xs text-muted-foreground">
                  {companySubscription.billing_cycle === "yearly"
                    ? t("yearlyBilling") || "年繳"
                    : t("monthlyBilling") || "月繳"}
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("subscriptionRemaining") || "本期剩餘"}
              </p>
              <p className="text-lg font-semibold">
                {companySubscription?.subscription_articles_remaining?.toLocaleString() ||
                  0}{" "}
                /{" "}
                {companySubscription?.articles_per_month?.toLocaleString() || 0}{" "}
                {t("articles") || "篇"}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("monthlyQuota") || "每月配額"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("purchasedRemaining") || "加購剩餘"}
              </p>
              <p className="text-lg font-semibold">
                {companySubscription?.purchased_articles_remaining?.toLocaleString() ||
                  0}{" "}
                {t("articles") || "篇"}
              </p>
              <p className="text-xs text-success mt-1">{t("neverExpires")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("quotaResetDate")}
              </p>
              <p className="text-lg font-semibold">
                {(() => {
                  // 計算下次月度配額重置日
                  if (!companySubscription?.current_period_start) return "-";
                  const startDate = new Date(
                    companySubscription.current_period_start,
                  );
                  const resetDay = startDate.getDate(); // 重置日 = 訂閱開始日
                  const now = new Date();
                  const nextReset = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    resetDay,
                  );
                  // 如果本月重置日已過，下次重置在下個月
                  if (now.getDate() >= resetDay) {
                    nextReset.setMonth(nextReset.getMonth() + 1);
                  }
                  // 確保不超過訂閱結束日
                  const endDate = companySubscription.current_period_end
                    ? new Date(companySubscription.current_period_end)
                    : null;
                  if (endDate && nextReset > endDate) {
                    return endDate.toLocaleDateString("zh-TW", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    });
                  }
                  return nextReset.toLocaleDateString("zh-TW", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div id="plans" className="mb-12">
        <SubscriptionPlans
          plans={plans}
          companyId={member.company_id}
          userEmail={user.email || ""}
          currentTier={company?.subscription_tier || "free"}
          currentSubscription={
            companySubscription
              ? {
                  plan_id: companySubscription.plan_id,
                  billing_cycle: companySubscription.billing_cycle,
                  articles_per_month: companySubscription.articles_per_month,
                  subscription_articles_remaining:
                    companySubscription.subscription_articles_remaining,
                  purchased_articles_remaining:
                    companySubscription.purchased_articles_remaining,
                }
              : null
          }
        />
      </div>

      <div className="mb-12">
        <h2 className="text-2xl font-bold mb-6">
          {t("articlePackagePurchase") || "文章加購包"}
        </h2>
        <ArticlePackages
          packages={articlePackages}
          companyId={member.company_id}
          userEmail={user.email || ""}
        />
      </div>

      <PaymentHistory orders={paymentOrders || []} />
    </div>
  );
}
