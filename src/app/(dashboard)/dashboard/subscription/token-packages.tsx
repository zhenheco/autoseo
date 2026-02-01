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
import { Coins } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Database } from "@/types/database.types";

type TokenPackage = Database["public"]["Tables"]["token_packages"]["Row"];

interface TokenPackagesProps {
  packages: TokenPackage[];
  companyId: string;
  userEmail: string;
}

export function TokenPackages({
  packages,
  companyId,
  userEmail,
}: TokenPackagesProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations("subscription");

  const handlePurchase = async (pkg: TokenPackage) => {
    try {
      setLoading(pkg.id);

      const response = await fetch("/api/payment/onetime/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          paymentType: "token_package",
          relatedId: pkg.id,
          amount: pkg.price,
          description: pkg.name,
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
      {packages.map((pkg) => (
        <Card key={pkg.id} className="border-blue-500">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Coins className="h-5 w-5" />
              {pkg.name}
            </CardTitle>
            <CardDescription>
              {pkg.tokens?.toLocaleString()} Credits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">
                  ${pkg.price?.toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("oneTimePurchaseNeverExpires")}
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => handlePurchase(pkg)}
              disabled={loading === pkg.id}
            >
              {loading === pkg.id ? t("processing") : t("buyNow")}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
