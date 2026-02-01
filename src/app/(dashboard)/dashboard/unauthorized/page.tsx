import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldAlert, Sparkles, Check, ArrowRight } from "lucide-react";
import { getUserSubscriptionTier } from "@/lib/permissions";
import { getTranslations } from "next-intl/server";

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  const subscriptionTier = await getUserSubscriptionTier();
  const isFreePlan =
    params.reason === "free-plan" || subscriptionTier === "free";
  const t = await getTranslations("unauthorized");

  // 免費方案限制的友善提示
  if (isFreePlan) {
    const features = [
      t("freePlan.feature1"),
      t("freePlan.feature2"),
      t("freePlan.feature3"),
      t("freePlan.feature4"),
      t("freePlan.feature5"),
      t("freePlan.feature6"),
    ];

    return (
      <div className="container mx-auto p-8 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-2xl w-full border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">{t("freePlan.title")}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t("freePlan.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* STARTER 方案特色 */}
            <div className="p-6 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
              <h3 className="font-semibold text-lg mb-4">
                {t("freePlan.starterFeatures")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* 價格 */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-3xl font-bold">NT$ 699</span>
                <span className="text-sm text-muted-foreground">{t("freePlan.perMonth")}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {t("freePlan.yearlyDiscount")}
                </span>
              </div>

              {/* CTA */}
              <div className="flex gap-3">
                <Button
                  asChild
                  className="flex-1 bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  <Link href="/dashboard/subscription#plans">
                    {t("freePlan.upgradeNow")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/#pricing">{t("freePlan.viewAllPlans")}</Link>
                </Button>
              </div>
            </div>

            {/* 返回按鈕 */}
            <div className="text-center">
              <Link href="/dashboard/articles">
                <Button variant="ghost">{t("freePlan.backToArticles")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 一般權限錯誤（角色不足）
  return (
    <div className="container mx-auto p-8 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl">{t("general.title")}</CardTitle>
          <CardDescription className="text-base mt-2">
            {t("general.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("general.contactAdmin")}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/dashboard/articles">
              <Button variant="outline">{t("general.backToArticles")}</Button>
            </Link>
            <Link href="/dashboard">
              <Button>{t("general.backToHome")}</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
