"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowLeft, Check, Sparkles } from "lucide-react";

/**
 * 社群點數套餐
 */
interface CreditPackage {
  id: string;
  name: string;
  slug: string;
  credits: number;
  price: number;
  description: string | null;
}

/**
 * 點數餘額
 */
interface CreditBalance {
  creditsRemaining: number;
  creditsUsed: number;
}

/**
 * 社群點數購買頁面
 *
 * 功能：
 * - 顯示目前點數餘額
 * - 顯示可購買的套餐
 * - 處理購買流程
 */
export default function SocialCreditsPage() {
  const t = useTranslations("social");
  const router = useRouter();

  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [companyId, setCompanyId] = useState("");

  // 載入資料
  useEffect(() => {
    async function loadData() {
      try {
        // 平行載入套餐和餘額
        const [packagesRes, balanceRes, userRes] = await Promise.all([
          fetch("/api/social/credits/packages"),
          fetch("/api/social/credits"),
          fetch("/api/user/profile"),
        ]);

        if (packagesRes.ok) {
          const data = await packagesRes.json();
          setPackages(data.packages || []);
        }

        if (balanceRes.ok) {
          const data = await balanceRes.json();
          setBalance(data);
        }

        if (userRes.ok) {
          const data = await userRes.json();
          setUserEmail(data.email || "");
          setCompanyId(data.companyId || "");
        }
      } catch (error) {
        console.error("載入資料失敗:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // 處理購買
  const handlePurchase = async (pkg: CreditPackage) => {
    if (!companyId || !userEmail) {
      alert("請先登入");
      return;
    }

    try {
      setPurchaseLoading(pkg.id);

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          paymentType: "social_credit_package",
          relatedId: pkg.id,
          amount: pkg.price,
          description: `購買 ${pkg.name}（${pkg.credits} 點社群發文點數）`,
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
      console.error("購買錯誤:", error);
      alert(
        `購買失敗: ${error instanceof Error ? error.message : "請稍後再試"}`,
      );
      setPurchaseLoading(null);
    }
  };

  // 取得套餐優惠標籤
  const getPackageTag = (slug: string) => {
    switch (slug) {
      case "social_basic":
        return { label: t("packPopular") || "熱門選擇", color: "bg-blue-500" };
      case "social_advanced":
        return {
          label: t("packBestValue") || "超值推薦",
          color: "bg-purple-500",
        };
      case "social_pro":
        return {
          label: t("packEnterprise") || "企業首選",
          color: "bg-gradient-to-r from-purple-600 to-pink-600",
        };
      default:
        return null;
    }
  };

  // 計算單價
  const getUnitPrice = (price: number, credits: number) => {
    return (price / credits).toFixed(1);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-80 bg-gray-200 dark:bg-gray-700 rounded-lg"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* 返回按鈕和標題 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/social">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToSocial") || "返回社群管理"}
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-purple-600" />
          {t("purchaseCredits") || "購買點數"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("purchaseCreditsDesc") ||
            "選擇適合您的點數套餐，一點等於一篇社群發文"}
        </p>
      </div>

      {/* 目前餘額 */}
      {balance && (
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
          <CardContent className="flex items-center justify-between py-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("currentBalance") || "目前餘額"}
                </p>
                <p className="text-3xl font-bold text-purple-600">
                  {balance.creditsRemaining.toLocaleString()}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {t("credits") || "點"}
                  </span>
                </p>
              </div>
            </div>
            {balance.creditsUsed > 0 && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {t("totalUsed") || "累計使用"}
                </p>
                <p className="text-xl font-semibold">
                  {balance.creditsUsed.toLocaleString()} {t("credits") || "點"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 套餐列表 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {packages.map((pkg) => {
          const tag = getPackageTag(pkg.slug);
          const unitPrice = getUnitPrice(pkg.price, pkg.credits);
          const isPopular = pkg.slug === "social_advanced";

          return (
            <Card
              key={pkg.id}
              className={`relative transition-all hover:shadow-lg ${
                isPopular
                  ? "border-purple-500 shadow-lg ring-2 ring-purple-500/20"
                  : "border-gray-200 dark:border-gray-700"
              }`}
            >
              {tag && (
                <div
                  className={`absolute -top-3 left-1/2 -translate-x-1/2 ${tag.color} text-white px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap`}
                >
                  {tag.label}
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">{pkg.name}</CardTitle>
                <CardDescription>
                  {pkg.description || `${pkg.credits} 點社群發文點數`}
                </CardDescription>
              </CardHeader>

              <CardContent className="text-center space-y-4">
                {/* 點數數量 */}
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <span className="text-4xl font-bold">
                    {pkg.credits.toLocaleString()}
                  </span>
                  <span className="text-lg text-muted-foreground">
                    {t("credits") || "點"}
                  </span>
                </div>

                {/* 價格 */}
                <div>
                  <div className="text-3xl font-bold">
                    NT${pkg.price.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("unitPrice") || "平均每點"} NT${unitPrice}
                  </div>
                </div>

                {/* 功能列表 */}
                <ul className="text-sm space-y-2 text-left px-2">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{t("featureNoExpiry") || "永久有效，不過期"}</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>
                      {t("featureAllPlatforms") || "支援所有社群平台"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{t("featureAIContent") || "AI 智慧文案生成"}</span>
                  </li>
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isPopular ? "default" : "outline"}
                  onClick={() => handlePurchase(pkg)}
                  disabled={purchaseLoading === pkg.id}
                >
                  {purchaseLoading === pkg.id
                    ? t("processing") || "處理中..."
                    : t("buyNow") || "立即購買"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* 說明 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("faq") || "常見問題"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">
              {t("faqQ1") || "一點可以發布幾篇貼文？"}
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t("faqA1") ||
                "一點等於一篇社群貼文，可發布到 Facebook、Instagram 或 Threads 其中一個平台。"}
            </p>
          </div>
          <div>
            <h4 className="font-medium">{t("faqQ2") || "點數會過期嗎？"}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t("faqA2") || "購買的點數永久有效，不會過期，可以慢慢使用。"}
            </p>
          </div>
          <div>
            <h4 className="font-medium">{t("faqQ3") || "可以退款嗎？"}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {t("faqA3") ||
                "已購買的點數無法退款，但可以轉移給其他帳號（請聯繫客服）。"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
