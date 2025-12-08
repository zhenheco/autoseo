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
import { Check, Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Database } from "@/types/database.types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

interface CurrentSubscription {
  plan_id: string;
  purchased_count: number;
  base_monthly_quota: number;
  monthly_token_quota: number;
}

interface SubscriptionPlansProps {
  plans: Plan[];
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
  const router = useRouter();
  const t = useTranslations("subscription");

  // 獲取翻譯後的方案名稱
  const getPlanName = (plan: Plan) => {
    const slug = plan.slug?.replace("-lifetime", "") || "";
    const translatedName = t.raw(`plans.${slug}`);
    return typeof translatedName === "string" ? translatedName : plan.name;
  };

  const handleSubscribe = async (plan: Plan, isStacking = false) => {
    try {
      setLoading(plan.id);

      const description = isStacking
        ? `${getPlanName(plan)} 疊加購買（+${plan.base_tokens?.toLocaleString()} 配額）`
        : `${getPlanName(plan)} 終身方案`;

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          paymentType: "lifetime",
          relatedId: plan.id,
          amount: plan.lifetime_price || 0,
          description,
          email: userEmail,
        }),
      });

      if (!response.ok) {
        throw new Error(`API 錯誤: ${response.status}`);
      }

      const data = await response.json();

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
    } catch (error) {
      console.error("訂閱錯誤:", error);
      alert(
        `訂閱失敗: ${error instanceof Error ? error.message : "請稍後再試"}`,
      );
      setLoading(null);
    }
  };

  const getPlanColor = (slug: string) => {
    if (slug.includes("starter")) return "border-blue-500";
    if (slug.includes("professional")) return "border-purple-500";
    if (slug.includes("business")) return "border-orange-500";
    return "border-border";
  };

  const getTierFromSlug = (slug: string): string => {
    return slug.replace(/-lifetime$/, "");
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => {
        const planTier = getTierFromSlug(plan.slug);
        const isCurrentPlan = planTier === currentTier;
        const canStack =
          isCurrentPlan && currentSubscription?.plan_id === plan.id;
        const purchasedCount = canStack
          ? currentSubscription?.purchased_count || 1
          : 0;

        return (
          <Card
            key={plan.id}
            className={`relative ${getPlanColor(plan.slug)} ${
              isCurrentPlan ? "ring-2 ring-primary" : ""
            }`}
          >
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                目前方案 {purchasedCount > 1 && `(x${purchasedCount})`}
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{getPlanName(plan)}</CardTitle>
              <CardDescription>
                {canStack && purchasedCount > 1 ? (
                  <>
                    每月{" "}
                    {(
                      (plan.base_tokens || 0) * purchasedCount
                    ).toLocaleString()}{" "}
                    Credits
                    <span className="text-xs text-muted-foreground ml-1">
                      ({plan.base_tokens?.toLocaleString()} x {purchasedCount})
                    </span>
                  </>
                ) : (
                  <>每月 {plan.base_tokens?.toLocaleString()} Credits</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-xl text-muted-foreground line-through">
                    NT$ {((plan.lifetime_price || 0) * 1.5).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-purple-600">
                    NT$ {plan.lifetime_price?.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-purple-600">
                  終身使用，月配額每月自動重置
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{plan.base_tokens?.toLocaleString()} Credits / 月</span>
                </div>
                {plan.features &&
                  Array.isArray(plan.features) &&
                  (plan.features as string[]).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
              </div>

              {canStack && (
                <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-1">
                  <p className="text-sm font-medium text-purple-700">
                    可疊加購買
                  </p>
                  <p className="text-xs text-purple-600">
                    再次購買可增加 +{plan.base_tokens?.toLocaleString()} 月配額
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              {canStack ? (
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(plan, true)}
                  disabled={loading === plan.id}
                  variant="outline"
                >
                  {loading === plan.id ? (
                    "處理中..."
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      再次購買（+配額）
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading === plan.id || isCurrentPlan}
                >
                  {loading === plan.id
                    ? "處理中..."
                    : isCurrentPlan
                      ? "目前方案"
                      : "立即訂閱"}
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
