"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database.types";
import {
  Check,
  Sparkles,
  ArrowRight,
  CreditCard,
  Crown,
  User,
  LogOut,
  LayoutDashboard,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SUPPORT_TIERS, type SupportLevel } from "@/config/support-tiers";

type SubscriptionPlan = Tables<"subscription_plans">;
type TokenPackage = Tables<"token_packages">;

interface PlanFeatures {
  models?: string[] | "all";
  wordpress_sites?: number;
  images_per_article?: number;
  team_members?: number;
  brand_voices?: number;
  api_access?: boolean;
  white_label?: boolean;
  support_level?: SupportLevel;
}

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [tokenPackages, setTokenPackages] = useState<TokenPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [processingPackageId, setProcessingPackageId] = useState<string | null>(
    null,
  );
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentTier, setCurrentTier] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || null);

        const { data: member } = await supabase
          .from("company_members")
          .select("company_id")
          .eq("user_id", user.id)
          .single();

        if (member) {
          const { data: subscription } = await supabase
            .from("company_subscriptions")
            .select("plan_id")
            .eq("company_id", member.company_id)
            .single();

          if (subscription) {
            const { data: plan } = await supabase
              .from("subscription_plans")
              .select("slug")
              .eq("id", subscription.plan_id)
              .single();

            if (plan) {
              setCurrentTier(plan.slug);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to load user:", error);
    }
  }

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  }

  async function loadPlans() {
    try {
      const supabase = createClient();
      const [plansRes, packagesRes] = await Promise.all([
        supabase
          .from("subscription_plans")
          .select("*")
          .eq("is_lifetime", true)
          .neq("slug", "free")
          .order("lifetime_price", { ascending: true }),
        supabase
          .from("token_packages")
          .select("*")
          .eq("is_active", true)
          .order("price", { ascending: true }),
      ]);

      if (plansRes.error) throw plansRes.error;
      if (packagesRes.error) throw packagesRes.error;

      if (plansRes.data) {
        setPlans(plansRes.data);
      }

      if (packagesRes.data) {
        const displayedPackages = packagesRes.data.filter((pkg) =>
          ["entry-10k", "standard-50k", "advanced-100k"].includes(pkg.slug),
        );
        setTokenPackages(displayedPackages);
      }
    } catch (error) {
      console.error("Failed to load plans:", error);
    } finally {
      setLoading(false);
    }
  }

  const submitPaymentForm = (paymentForm: {
    merchantId: string;
    tradeInfo?: string;
    tradeSha?: string;
    postData?: string;
    postDataSha?: string;
    version?: string;
    apiUrl: string;
  }) => {
    const formData = {
      apiUrl: paymentForm.apiUrl,
      postData: paymentForm.postData,
      tradeInfo: paymentForm.tradeInfo,
      tradeSha: paymentForm.tradeSha,
      version: paymentForm.version,
      merchantId: paymentForm.merchantId,
    };

    const encodedFormData = encodeURIComponent(JSON.stringify(formData));
    const authorizingUrl = `/dashboard/billing/authorizing?paymentForm=${encodedFormData}`;
    router.push(authorizingUrl);
  };

  async function handlePlanPurchase(plan: SubscriptionPlan) {
    try {
      setProcessingPlanId(plan.id);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/pricing");
        return;
      }

      const { data: companies } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1);

      const companyId = companies?.[0]?.company_id;
      if (!companyId) {
        alert("找不到公司資訊，請先完成註冊");
        return;
      }

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          paymentType: "lifetime",
          relatedId: plan.id,
          amount: plan.lifetime_price || 0,
          description: `${plan.name} 終身方案`,
          email: user.email || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "支付請求失敗");
      }

      if (data.paymentForm) {
        submitPaymentForm(data.paymentForm);
      }
    } catch (error) {
      console.error("購買失敗:", error);
      alert(error instanceof Error ? error.message : "購買失敗，請稍後再試");
    } finally {
      setProcessingPlanId(null);
    }
  }

  async function handleTokenPackagePurchase(pkg: TokenPackage) {
    try {
      setProcessingPackageId(pkg.id);

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login?redirect=/pricing");
        return;
      }

      const { data: companies } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .limit(1);

      const companyId = companies?.[0]?.company_id;
      if (!companyId) {
        alert("找不到公司資訊，請先完成註冊");
        return;
      }

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          paymentType: "token_package",
          relatedId: pkg.id,
          amount: pkg.price,
          description: `購買 ${pkg.name}`,
          email: user.email || "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "支付請求失敗");
      }

      if (data.paymentForm) {
        submitPaymentForm(data.paymentForm);
      }
    } catch (error) {
      console.error("購買失敗:", error);
      alert(error instanceof Error ? error.message : "購買失敗，請稍後再試");
    } finally {
      setProcessingPackageId(null);
    }
  }

  const renderFeatureList = (features: PlanFeatures) => {
    const items = [];

    if (features.wordpress_sites !== undefined) {
      items.push(
        <li key="sites" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.wordpress_sites === -1
              ? "無限 WordPress 網站"
              : `${features.wordpress_sites} 個 WordPress 網站`}
          </span>
        </li>,
      );
    }

    if (features.team_members !== undefined) {
      items.push(
        <li key="team" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.team_members === -1
              ? "無限團隊成員"
              : `${features.team_members} 個團隊成員`}
          </span>
        </li>,
      );
    }

    if (features.brand_voices !== undefined) {
      items.push(
        <li key="voices" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {features.brand_voices === -1
              ? "無限品牌聲音"
              : features.brand_voices === 0
                ? "無品牌聲音"
                : `${features.brand_voices} 個品牌聲音`}
          </span>
        </li>,
      );
    }

    if (features.api_access) {
      items.push(
        <li key="api" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            API 存取
          </span>
        </li>,
      );
    }

    if (features.white_label) {
      items.push(
        <li key="white" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            白標服務
          </span>
        </li>,
      );
    }

    if (features.support_level) {
      const supportTier = SUPPORT_TIERS[features.support_level];
      items.push(
        <li key="support" className="flex items-start gap-3 group">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {supportTier.label}
          </span>
        </li>,
      );
    }

    return items;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="absolute inset-0 h-12 w-12 rounded-full bg-primary/20 blur-xl animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">
            載入中...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden">
      <header className="sticky top-0 z-50 h-16 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-8">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">AutoPilot SEO</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />

            {userEmail ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-9 w-9 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarImage src="" alt="User avatar" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">
                        使用者帳號
                      </p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {userEmail}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      <span>控制台</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="cursor-pointer"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>登出</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  登入
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse" />
      <div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl opacity-20 animate-pulse"
        style={{ animationDelay: "1s" }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center mb-16 space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 backdrop-blur-sm">
            <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
              終身定價 - 一次付清，永久享有
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
            選擇最適合您的方案
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            無論您是個人創作者、成長中的團隊或是大型企業，我們都有最適合您的解決方案
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-16 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const features = plan.features as PlanFeatures;
            const isRecommended = plan.slug === "professional";
            const isCurrentPlan = currentTier === plan.slug;

            return (
              <div
                key={plan.id}
                className={`group relative rounded-3xl transition-all duration-500 ${
                  isRecommended ? "lg:scale-105" : "lg:hover:scale-105"
                }`}
              >
                {isRecommended && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-primary via-primary to-secondary text-white border-0 px-5 py-1.5 shadow-lg shadow-primary/40 text-sm font-semibold">
                      <Zap className="w-4 h-4 mr-1.5" />
                      推薦方案
                    </Badge>
                  </div>
                )}

                <div
                  className={`relative h-full flex flex-col rounded-3xl border p-6 transition-all duration-500 ${
                    isRecommended
                      ? "border-primary/50 shadow-2xl shadow-primary/30 hover:shadow-primary/40 bg-gradient-to-br from-primary/5 via-transparent to-primary/5"
                      : "border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/20 bg-card"
                  }`}
                >
                  <div className="mb-6">
                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>

                    <div className="mb-1">
                      <div className="text-lg text-muted-foreground mb-1">
                        NT$
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {plan.lifetime_price?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                      一次付清，終身享有
                    </p>
                  </div>

                  <div className="mb-6 p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="text-2xl font-bold text-primary mb-1">
                      {(plan.base_tokens / 1000).toLocaleString()}K
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Credits / 月
                    </div>
                    <div className="text-xs text-muted-foreground/70 mt-1">
                      每月重置
                    </div>
                  </div>

                  <ul className="space-y-2 mb-6 flex-1">
                    {renderFeatureList(features)}
                  </ul>

                  <Button
                    onClick={() => handlePlanPurchase(plan)}
                    disabled={processingPlanId === plan.id || isCurrentPlan}
                    className={`w-full group/button mt-auto ${
                      isRecommended
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                        : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                    }`}
                  >
                    <span>
                      {processingPlanId === plan.id
                        ? "處理中..."
                        : isCurrentPlan
                          ? "目前方案"
                          : "開始使用"}
                    </span>
                    {processingPlanId !== plan.id && !isCurrentPlan && (
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/button:translate-x-1 transition-transform" />
                    )}
                  </Button>
                </div>

                {isRecommended && (
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 blur-2xl opacity-50 group-hover:opacity-75 transition-opacity" />
                )}
              </div>
            );
          })}
        </div>

        <section className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">客服支援層級</h2>
            <p className="text-lg text-muted-foreground">
              不同方案享有不同等級的客戶支援服務
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      支援等級
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      響應時間
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      支援渠道
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold">
                      服務時間
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(SUPPORT_TIERS).map(([key, tier]) => (
                    <tr key={key} className="hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">{tier.label}</td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {tier.response_time}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {tier.channels.join(", ")}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {tier.availability}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="text-center mb-12 space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 backdrop-blur-sm">
              <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                彈性加值包（永不過期）
              </span>
            </div>
            <h2 className="text-4xl font-bold">彈性加值，永不過期</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              一次性購買 Credit 包，永久有效不過期
            </p>
          </div>

          <div className="flex justify-center mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl">
              {tokenPackages.map((pkg) => {
                const perTokenPrice = (pkg.price / (pkg.tokens / 1000)).toFixed(
                  2,
                );
                return (
                  <div
                    key={pkg.id}
                    className="group relative bg-card rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 border border-border hover:border-amber-400 dark:hover:border-amber-500"
                  >
                    <div className="text-center space-y-3">
                      <div className="text-3xl font-bold">
                        {(pkg.tokens / 1000).toLocaleString()}K
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Credits
                      </div>
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                        NT$ {pkg.price.toLocaleString()}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        單價: NT$ {perTokenPrice} / 1K
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleTokenPackagePurchase(pkg)}
                        disabled={processingPackageId === pkg.id}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                      >
                        {processingPackageId === pkg.id ? "處理中..." : "購買"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
