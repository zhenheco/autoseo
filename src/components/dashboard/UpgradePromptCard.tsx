"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

interface UpgradePromptCardProps {
  currentTier: "free" | "starter" | "professional" | "business" | "agency";
  tokenBalance: number;
}

interface LifetimePlan {
  id: string;
  slug: string;
  name: string;
  lifetime_price: number;
  base_tokens: number;
  max_websites: number;
  max_team_members: number;
}

export function UpgradePromptCard({
  currentTier,
  tokenBalance,
}: UpgradePromptCardProps) {
  const router = useRouter();
  const [processingSlug, setProcessingSlug] = useState<string | null>(null);
  const [plans, setPlans] = useState<LifetimePlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("subscription_plans")
        .select(
          "id, slug, name, lifetime_price, base_tokens, max_websites, max_team_members",
        )
        .in("slug", ["starter", "professional", "business", "agency"])
        .not("lifetime_price", "is", null)
        .order("lifetime_price", { ascending: true });

      if (data) {
        setPlans(data);
      }
    } catch (error) {
      console.error("Failed to fetch plans:", error);
    } finally {
      setLoading(false);
    }
  };

  if (currentTier !== "free") {
    return null;
  }

  if (loading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-lg animate-pulse">
        <CardHeader className="pb-4">
          <div className="h-24"></div>
        </CardHeader>
      </Card>
    );
  }

  const isLowBalance = tokenBalance < 5000;

  const planFeatures: Record<string, string[]> = {
    starter: [
      "連接 1 個 WordPress 網站",
      "使用全部 AI 模型",
      "每篇文章無限圖片",
      "優先客服支援",
    ],
    professional: [
      "連接 5 個 WordPress 網站",
      "3 個團隊成員",
      "API 存取",
      "品牌聲音設定",
    ],
    business: [
      "連接 10 個 WordPress 網站",
      "10 個團隊成員",
      "專屬客戶經理",
      "進階分析報告",
    ],
    agency: [
      "無限 WordPress 網站",
      "無限團隊成員",
      "白牌解決方案",
      "專屬 API 配額",
    ],
  };

  const planGradients: Record<
    string,
    { gradient: string; borderColor: string }
  > = {
    starter: {
      gradient:
        "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    professional: {
      gradient: "from-primary/10 to-secondary/10",
      borderColor: "border-primary/50",
    },
    business: {
      gradient:
        "from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30",
      borderColor: "border-purple-200 dark:border-purple-800",
    },
    agency: {
      gradient:
        "from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
  };

  const handleUpgrade = async (planId: string, planSlug: string) => {
    try {
      setProcessingSlug(planSlug);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/dashboard");
        return;
      }

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          planId: planId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "支付請求失敗");
      }

      if (data.paymentForm) {
        const formData = {
          apiUrl: data.paymentForm.apiUrl,
          postData: data.paymentForm.postData,
          tradeInfo: data.paymentForm.tradeInfo,
          tradeSha: data.paymentForm.tradeSha,
          version: data.paymentForm.version,
          merchantId: data.paymentForm.merchantId,
        };

        const encodedFormData = encodeURIComponent(JSON.stringify(formData));
        router.push(
          `/dashboard/billing/authorizing?paymentForm=${encodedFormData}`,
        );
      }
    } catch (error) {
      console.error("升級失敗:", error);
      alert(error instanceof Error ? error.message : "升級失敗，請稍後再試");
    } finally {
      setProcessingSlug(null);
    }
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(0)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const displayPlans = plans.slice(0, 2);

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl">升級解鎖更多功能</CardTitle>
            <CardDescription>
              {isLowBalance
                ? "您的 Credit 即將用完，升級獲得更多配額！"
                : "一次付費，終身使用，讓您的 SEO 更上一層樓"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayPlans.map((plan, index) => {
            const styles = planGradients[plan.slug] || planGradients.starter;
            const features = planFeatures[plan.slug] || [];
            const isPopular = plan.slug === "professional";

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative p-5 rounded-xl border-2 bg-gradient-to-br transition-all duration-300 hover:shadow-lg",
                  styles.gradient,
                  styles.borderColor,
                )}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-md">
                      <Zap className="h-3 w-3" />
                      最受歡迎
                    </span>
                  </div>
                )}

                <div className="mb-3">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">
                      NT$ {plan.lifetime_price.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">終身</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-sm font-semibold text-primary">
                      {formatTokens(plan.base_tokens)} credits
                    </span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  {features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                        <Check className="h-2.5 w-2.5 text-primary" />
                      </div>
                      <span className="text-xs text-foreground leading-tight">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleUpgrade(plan.id, plan.slug)}
                  disabled={processingSlug === plan.slug}
                  className={cn(
                    "w-full",
                    isPopular
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80 text-secondary-foreground",
                  )}
                  size="sm"
                >
                  {processingSlug === plan.slug ? "處理中..." : "立即升級"}
                  {processingSlug !== plan.slug && (
                    <ArrowRight className="ml-2 h-3 w-3" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-end">
          <Button asChild variant="ghost" size="sm" className="text-xs">
            <Link href="/#pricing">
              查看所有方案
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
