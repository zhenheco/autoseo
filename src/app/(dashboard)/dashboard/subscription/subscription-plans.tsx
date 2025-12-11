"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Gift, FileText } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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

  // 計算年繳贈送的篇數
  const getYearlyBonus = (plan: ArticlePlan) => {
    return plan.articles_per_month * (plan.yearly_bonus_months || 2);
  };

  const handleSubscribe = async (plan: ArticlePlan) => {
    try {
      setLoading(plan.id);

      const price =
        billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
      const description = `${getPlanName(plan)} ${billingCycle === "yearly" ? "年繳" : "月繳"}訂閱`;

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
            metadata: { billingCycle },
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
          const formData = {
            apiUrl: data.paymentForm.apiUrl,
            tradeInfo: data.paymentForm.tradeInfo,
            tradeSha: data.paymentForm.tradeSha,
            version: data.paymentForm.version,
            merchantId: data.paymentForm.merchantId,
          };

          const encodedForm = encodeURIComponent(JSON.stringify(formData));
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
        // 判斷是定期定額（postData）還是單次付款（tradeInfo）
        const isRecurring = !!data.paymentForm.postData;

        const formData = isRecurring
          ? {
              // 定期定額使用 postData
              apiUrl: data.paymentForm.apiUrl,
              postData: data.paymentForm.postData,
              merchantId: data.paymentForm.merchantId,
            }
          : {
              // 單次付款使用 tradeInfo
              apiUrl: data.paymentForm.apiUrl,
              tradeInfo: data.paymentForm.tradeInfo,
              tradeSha: data.paymentForm.tradeSha,
              version: data.paymentForm.version,
              merchantId: data.paymentForm.merchantId,
            };

        const encodedForm = encodeURIComponent(JSON.stringify(formData));
        router.push(
          `/dashboard/billing/authorizing?paymentForm=${encodedForm}`,
        );
      } else {
        throw new Error("缺少付款表單資料");
      }
    } catch (error) {
      console.error("訂閱錯誤:", error);
      alert(
        `訂閱失敗: ${error instanceof Error ? error.message : "請稍後再試"}`,
      );
      setLoading(null);
    }
  };

  const getPlanColor = (slug: string) => {
    if (slug === "starter") return "border-blue-500";
    if (slug === "pro") return "border-purple-500";
    if (slug === "business") return "border-orange-500";
    return "border-border";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {t("subscriptionPlans") || "訂閱方案"}
        </h2>

        {/* 月繳/年繳切換器 */}
        <div className="inline-flex items-center gap-2 rounded-full bg-muted p-1">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              billingCycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("monthlyBilling") || "月繳"}
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
              billingCycle === "yearly"
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("yearlyBilling") || "年繳"}
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-400 text-slate-900">
              {t("yearlyBonus") || "送2個月"}
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.slug === currentTier;
          const isPopular = plan.slug === "pro";
          const price =
            billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;
          const yearlyBonus = getYearlyBonus(plan);

          return (
            <Card
              key={plan.id}
              className={`relative ${getPlanColor(plan.slug)} ${
                isCurrentPlan ? "ring-2 ring-primary" : ""
              } ${isPopular ? "shadow-lg" : ""}`}
            >
              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  {t("currentPlan") || "目前方案"}
                </div>
              )}
              {isPopular && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  {t("mostPopular") || "最受歡迎"}
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{getPlanName(plan)}</CardTitle>
                <CardDescription className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-foreground">
                      NT${price?.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      /{billingCycle === "yearly" ? "年" : "月"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (
                    <p className="text-sm text-muted-foreground">
                      約 NT${Math.round((price || 0) / 12).toLocaleString()}/月
                    </p>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 每月篇數顯示 */}
                <div className="rounded-lg bg-muted p-3">
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <span className="text-lg font-bold">
                      {t("monthly") || "每月"}{" "}
                      {plan.articles_per_month?.toLocaleString()}{" "}
                      {t("articles") || "篇"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && yearlyBonus > 0 && (
                    <div className="flex items-center justify-center gap-1 mt-2 text-sm text-purple-600">
                      <Gift className="h-4 w-4" />
                      <span className="font-medium">
                        {t("bonusArticles") || "再送"} {yearlyBonus}{" "}
                        {t("articles") || "篇"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {(() => {
                    const features = plan.features;
                    if (features && Array.isArray(features)) {
                      return (features as string[]).map((feature, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ));
                    }
                    return null;
                  })()}
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {t("allAIModels") || "所有 AI 模型"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {t("wordpressIntegration") || "WordPress 整合"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-sm">
                      {t("autoImageGen") || "自動圖片生成"}
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(plan)}
                  disabled={
                    loading === plan.id || isCurrentPlan || !canSubscribe(plan)
                  }
                  variant={
                    isCurrentPlan || !canSubscribe(plan)
                      ? "secondary"
                      : isPopular
                        ? "default"
                        : "outline"
                  }
                >
                  {loading === plan.id
                    ? t("processing") || "處理中..."
                    : isCurrentPlan
                      ? t("currentPlan") || "目前方案"
                      : !canSubscribe(plan)
                        ? t("cannotDowngrade") || "無法訂閱"
                        : t("subscribe") || "立即訂閱"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
