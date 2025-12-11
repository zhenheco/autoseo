"use client";

import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { ArticleQuotaCard } from "@/components/dashboard/ArticleQuotaCard";
import { UpgradePromptCard } from "@/components/dashboard/UpgradePromptCard";
import { FileText, Globe } from "lucide-react";

interface DashboardClientProps {
  userEmail: string;
  articlesCount: number;
  websitesCount: number;
  subscriptionTier: string;
  tokenBalance: number;
}

export function DashboardClient({
  userEmail,
  articlesCount,
  websitesCount,
  subscriptionTier,
  tokenBalance,
}: DashboardClientProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("welcome", { email: userEmail })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("totalArticles")}
          value={articlesCount.toString()}
          icon={FileText}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          title={t("websiteCount")}
          value={websitesCount.toString()}
          icon={Globe}
          iconBgColor="bg-success/10"
          iconColor="text-success"
        />
        <ArticleQuotaCard />
      </div>

      {/* 免費用戶升級提示 */}
      {subscriptionTier === "free" && (
        <div className="mt-6">
          <UpgradePromptCard
            currentTier={subscriptionTier}
            tokenBalance={tokenBalance}
          />
        </div>
      )}

      <Card className="border-border/30 bg-muted/30 backdrop-blur-sm rounded-xl opacity-60">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-muted-foreground flex items-center gap-2">
            🚧 {t("trafficTrend")}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {t("featureInDevelopment")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-muted-foreground/30">
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold">
                🚧 {t("underDevelopment")}
              </p>
              <p className="text-sm">{t("trafficChartComingSoon")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
