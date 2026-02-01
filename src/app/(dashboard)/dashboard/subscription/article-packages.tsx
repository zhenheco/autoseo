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
import { FileText } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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
}

interface ArticlePackagesProps {
  packages: ArticlePackage[];
  companyId: string;
  userEmail: string;
}

export function ArticlePackages({
  packages,
  companyId,
  userEmail,
}: ArticlePackagesProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations("subscription");

  const handlePurchase = async (pkg: ArticlePackage) => {
    try {
      setLoading(pkg.id);

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          paymentType: "article_package",
          relatedId: pkg.id,
          amount: pkg.price,
          description: `${pkg.name} (${pkg.articles} ${t("articles")})`,
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
    } catch (error) {
      console.error("購買錯誤:", error);
      alert(
        `${t("purchaseFailed")}: ${error instanceof Error ? error.message : t("processing")}`,
      );
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {packages.map((pkg) => {
        const isPopular = pkg.slug === "pack_5";
        return (
          <Card
            key={pkg.id}
            className={`relative ${isPopular ? "border-purple-500 shadow-lg" : "border-blue-500"}`}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                {t("greatValue")}
              </div>
            )}
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                {pkg.name}
              </CardTitle>
              <CardDescription>
                {pkg.articles?.toLocaleString()} {t("articles")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    NT${pkg.price?.toLocaleString()}
                  </span>
                </div>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground">
                    {pkg.description}
                  </p>
                )}
                <p className="text-sm text-green-600">
                  {t("oneTimePurchaseNeverExpires")}
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => handlePurchase(pkg)}
                disabled={loading === pkg.id}
                variant={isPopular ? "default" : "outline"}
              >
                {loading === pkg.id ? t("processing") : t("buyNow")}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
