"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Gift, FileText, Loader2, X, Tag } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trackBeginCheckout, trackViewItem } from "@/lib/analytics/events";

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

interface CurrentSubscription {
  plan_id: string;
  billing_cycle: "monthly" | "yearly";
  articles_per_month: number;
  subscription_articles_remaining: number;
  purchased_articles_remaining: number;
}

interface SubscriptionPlansProps {
  plans: ArticlePlan[];
  companyId: string;
  userEmail: string;
  currentTier: string;
  currentSubscription?: CurrentSubscription | null;
}

export function SubscriptionPlans({
  plans,
  companyId,
  userEmail,
  currentTier,
  currentSubscription,
}: SubscriptionPlansProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    currentSubscription?.billing_cycle || "yearly",
  );
  const router = useRouter();
  const t = useTranslations("subscription");

  // 優惠碼相關 state
  const [promoCode, setPromoCode] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoValid, setPromoValid] = useState<boolean | null>(null);
  const [promoData, setPromoData] = useState<{
    code: string;
    name: string;
    bonusArticles: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // 驗證優惠碼
  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;

    setPromoValidating(true);
    setPromoError(null);
    setPromoValid(null);
    setPromoData(null);

    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setPromoValid(true);
        setPromoData(data.data);
      } else {
        setPromoValid(false);
        setPromoError(data.error || t("promoCodeInvalid"));
      }
    } catch {
      setPromoValid(false);
      setPromoError(t("promoCodeValidationFailed"));
    } finally {
      setPromoValidating(false);
    }
  };

  // 清除優惠碼
  const handleClearPromo = () => {
    setPromoCode("");
    setPromoValid(null);
    setPromoData(null);
    setPromoError(null);
  };

  // 獲取當前方案的價格（用於判斷是否可以降級）
  const currentPlan = plans.find((p) => p.slug === currentTier);
  const currentPlanPrice = currentPlan?.monthly_price || 0;

  // 判斷是否可以訂閱（只能升級，不能降級）
  const canSubscribe = (plan: ArticlePlan) => {
    // 如果沒有當前方案（免費用戶），可以訂閱任何方案
    if (!currentPlan || currentTier === "free") return true;
    // 只能訂閱價格更高的方案（升級）
    return plan.monthly_price > currentPlanPrice;
  };

  // 獲取翻譯後的方案名稱
  const getPlanName = (plan: ArticlePlan) => {
    const slug = plan.slug || "";
    const translatedName = t.raw(`plans.${slug}`);
    return typeof translatedName === "string" ? translatedName : plan.name;
  };

  // 計算年繳加贈的篇數（原始額度 × 200%）
  const getYearlyBonus = (plan: ArticlePlan) => {
    return plan.articles_per_month * 2;
  };

  const handleSubscribe = async (plan: ArticlePlan) => {
    try {
      setLoading(plan.id);

      const price =
        billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
      const description = `${getPlanName(plan)} ${billingCycle === "yearly" ? t("yearlyBilling") : t("monthlyBilling")}`;

      // GA4 追蹤：開始結帳
      trackBeginCheckout(
        [{ item_id: plan.id, item_name: getPlanName(plan), price: price || 0 }],
        price || 0,
      );

      // 使用定期定額 API（目前暫時返回 410，Phase 4 會重新啟用）
      const response = await fetch("/api/payment/recurring/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          planId: plan.id,
          billingCycle,
          amount: price || 0,
          description,
          email: userEmail,
        }),
      });

      if (response.status === 410) {
        // 定期定額尚未啟用，暫時使用一次性付款
        const onetimeResponse = await fetch("/api/payment/onetime/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            paymentType: "subscription",
            relatedId: plan.id,
            amount: price || 0,
            description,
            email: userEmail,
            metadata: {
              billingCycle,
              promoCode: promoValid && promoData ? promoData.code : undefined,
            },
          }),
        });

        if (!onetimeResponse.ok) {
          throw new Error(`API 錯誤: ${onetimeResponse.status}`);
        }

        const data = await onetimeResponse.json();

        if (!data.success) {
          throw new Error(data.error || "未知錯誤");
        }

        if (data.paymentForm) {
          // 新格式：直接使用 SDK 返回的 { action, method, fields } 格式
          const encodedForm = encodeURIComponent(
            JSON.stringify(data.paymentForm),
          );
          router.push(
            `/dashboard/billing/authorizing?paymentForm=${encodedForm}`,
          );
        } else {
          throw new Error("缺少付款表單資料");
        }
        return;
      }

      if (!response.ok) {
        throw new Error(`API 錯誤: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "未知錯誤");
      }

      if (data.paymentForm) {
        // 新格式：SDK 返回 { action, method, fields }
        // 舊格式（定期定額）：{ apiUrl, postData, merchantId }
        // 這裡直接傳遞，授權頁面會根據格式自動處理
        const encodedForm = encodeURIComponent(
          JSON.stringify(data.paymentForm),
        );
        router.push(
          `/dashboard/billing/authorizing?paymentForm=${encodedForm}`,
        );
      } else {
        throw new Error("缺少付款表單資料");
      }
    } catch (error) {
      console.error("訂閱錯誤:", error);
      alert(
        `${t("subscribeFailed")}: ${error instanceof Error ? error.message : t("processing")}`,
      );
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 標題與月繳/年繳切換器 */}
      <div className="text-center space-y-4">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t("subscriptionPlans") || "訂閱方案"}
        </h2>

        {/* 月繳/年繳切換器 */}
        <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-800/50 shadow-md border border-slate-200 dark:border-white/10 p-1">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              billingCycle === "monthly"
                ? "bg-slate-900 dark:bg-cyber-violet-600 text-white"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {t("monthlyBilling") || "月繳"}
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-cyber-violet-600 to-cyber-magenta-600 text-white"
          >
            {t("yearlyBilling") || "年繳"}
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400 text-slate-900">
              {t("yearlyBonus") || "多送200%"}
            </span>
          </button>
        </div>

        {/* 優惠碼輸入區塊 */}
        <div className="max-w-md mx-auto mt-6">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 shadow-sm">
            <Tag className="h-4 w-4 text-slate-400 shrink-0" />
            <Input
              placeholder={t("promoCodePlaceholder")}
              value={promoCode}
              onChange={(e) => {
                setPromoCode(e.target.value.toUpperCase());
                if (promoValid !== null) {
                  setPromoValid(null);
                  setPromoData(null);
                  setPromoError(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleValidatePromo();
                }
              }}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
              disabled={promoValidating || promoValid === true}
            />
            {promoValid === true ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearPromo}
                className="shrink-0 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleValidatePromo}
                disabled={promoValidating || !promoCode.trim()}
                className="shrink-0"
              >
                {promoValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("apply")
                )}
              </Button>
            )}
          </div>

          {/* 優惠碼驗證結果 */}
          {promoValid === true && promoData && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <Badge
                variant="default"
                className="bg-green-500 hover:bg-green-600"
              >
                <Gift className="h-3 w-3 mr-1" />
                {t("monthlyBonusArticles", { count: promoData.bonusArticles })}
              </Badge>
            </div>
          )}
          {promoValid === false && promoError && (
            <p className="mt-2 text-sm text-red-500 text-center">
              {promoError}
            </p>
          )}
        </div>
      </div>

      {/* 方案卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {plans.map((plan) => {
          const isCurrentPlan = plan.slug === currentTier;
          const isPopular = plan.slug === "pro";
          const price =
            billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
          const yearlyBonus = getYearlyBonus(plan);

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col h-full transition-all duration-300 ${
                isPopular
                  ? "bg-white dark:bg-slate-900/90 dark:backdrop-blur-xl text-slate-900 dark:text-white border-cyber-violet-500 shadow-lg dark:shadow-cyber-violet-500/30 scale-105"
                  : "bg-white dark:bg-transparent dark:glass shadow-md dark:shadow-none border-slate-200 dark:border-white/10 hover:border-cyber-violet-500/50"
              } ${isCurrentPlan ? "ring-2 ring-primary" : ""}`}
            >
              {/* 標籤 */}
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  {t("currentPlan") || "目前方案"}
                </div>
              )}
              {isPopular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-slate-900 px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                  {t("mostPopular") || "最熱門"}
                </div>
              )}

              <CardContent className="p-6 flex flex-col h-full">
                {/* 方案名稱 */}
                <div className="mb-3">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {getPlanName(plan)}
                  </h3>
                </div>

                {/* 價格 */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900 dark:text-white">
                      NT${price?.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      /
                      {billingCycle === "yearly"
                        ? t("year") || "年"
                        : t("month") || "月"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (
                    <div className="text-sm mt-1 text-slate-500 dark:text-slate-400">
                      {t("equivalentMonthly") || "約"} NT$
                      {Math.round((price || 0) / 12).toLocaleString()}/
                      {t("month") || "月"}
                    </div>
                  )}
                </div>

                {/* 每月篇數 */}
                <div className="rounded-lg p-3 mb-4 bg-slate-100 dark:bg-white/5">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-cyber-violet-500" />
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {t("monthly") || "每月"}{" "}
                      {plan.articles_per_month?.toLocaleString()}{" "}
                      {t("articles") || "篇"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && yearlyBonus > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-2 text-sm text-cyber-magenta-500 dark:text-cyber-magenta-400">
                      <Gift className="h-4 w-4" />
                      <span className="font-medium">
                        {t("bonusArticles") || "每月加贈"} {yearlyBonus}{" "}
                        {t("articles") || "篇"}
                      </span>
                    </div>
                  )}
                </div>

                {/* 功能列表 */}
                <div className="flex-1">
                  <ul className="space-y-2 text-sm mb-4 text-slate-700 dark:text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                      {t("allAIModels") || "所有 AI 模型"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                      {t("wordpressIntegration") || "WordPress 整合"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                      {t("autoImageGen") || "自動圖片生成"}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-cyber-cyan-400" />
                      {t("scheduledPublish") || "排程發布"}
                    </li>
                  </ul>
                </div>

                {/* 訂閱按鈕 */}
                <Button
                  size="sm"
                  className={`w-full mt-auto font-bold ${
                    isCurrentPlan
                      ? "bg-slate-200 text-slate-500 hover:bg-slate-200 cursor-not-allowed"
                      : !canSubscribe(plan)
                        ? "bg-slate-300 text-slate-500 hover:bg-slate-300 cursor-not-allowed"
                        : "bg-gradient-to-r from-cyber-violet-600 to-cyber-magenta-600 text-white hover:from-cyber-violet-500 hover:to-cyber-magenta-500"
                  } shadow-lg`}
                  onClick={() => handleSubscribe(plan)}
                  disabled={
                    loading === plan.id || isCurrentPlan || !canSubscribe(plan)
                  }
                >
                  {loading === plan.id
                    ? t("processing") || "處理中..."
                    : isCurrentPlan
                      ? t("currentPlan") || "目前方案"
                      : !canSubscribe(plan)
                        ? t("cannotDowngrade") || "無法降級"
                        : t("subscribe") || "立即訂閱"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
