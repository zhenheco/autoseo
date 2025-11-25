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
import { Check } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Database } from "@/types/database.types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

interface SubscriptionPlansProps {
  plans: Plan[];
  companyId: string;
  userEmail: string;
  currentTier: string;
}

export function SubscriptionPlans({
  plans,
  companyId,
  userEmail,
  currentTier,
}: SubscriptionPlansProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleSubscribe = async (plan: Plan) => {
    try {
      setLoading(plan.id);

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          paymentType: "lifetime",
          relatedId: plan.id,
          amount: plan.lifetime_price || 0,
          description: `${plan.name} 終身方案`,
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
        router.push(`/dashboard/billing/checkout?paymentForm=${encodedForm}`);
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
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan) => {
        const planTier = getTierFromSlug(plan.slug);
        const isCurrentPlan = planTier === currentTier;

        return (
          <Card
            key={plan.id}
            className={`relative ${getPlanColor(plan.slug)} ${
              isCurrentPlan ? "ring-2 ring-primary" : ""
            }`}
          >
            {isCurrentPlan && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                目前方案
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>
                每月 {plan.base_tokens?.toLocaleString()} Credits
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
                  <span className="text-muted-foreground">一次性</span>
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
            </CardContent>
            <CardFooter>
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
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
