"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/dashboard/stat-card";
import { ArticleQuotaCard } from "@/components/dashboard/ArticleQuotaCard";
import { UpgradePromptCard } from "@/components/dashboard/UpgradePromptCard";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";
import { FileText, Globe, Search } from "lucide-react";

interface Website {
  id: string;
  website_name: string;
  wordpress_url: string;
  is_platform_blog: boolean | null;
}

interface DashboardClientProps {
  userEmail: string;
  articlesCount: number;
  websitesCount: number;
  subscriptionTier: string;
  tokenBalance: number;
  websites: Website[];
}

export function DashboardClient({
  userEmail,
  articlesCount,
  websitesCount,
  subscriptionTier,
  tokenBalance,
  websites,
}: DashboardClientProps) {
  const t = useTranslations("dashboard");
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string>(
    websites.length > 0 ? websites[0].id : "",
  );

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

      {/* Search Console 數據面板 */}
      <Card className="border-border/30 bg-card/50 backdrop-blur-sm rounded-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-2xl font-bold flex items-center gap-2">
              <Search className="h-6 w-6" />
              {t("searchConsoleData")}
            </CardTitle>
            {websites.length > 0 && (
              <Select
                value={selectedWebsiteId}
                onValueChange={setSelectedWebsiteId}
              >
                <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder={t("selectWebsite")} />
                </SelectTrigger>
                <SelectContent>
                  {websites.map((website) => (
                    <SelectItem key={website.id} value={website.id}>
                      {website.website_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <CardDescription className="text-base">
            {t("searchConsoleDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {websites.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              <div className="text-center space-y-2">
                <Globe className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="text-lg font-semibold">{t("noWebsites")}</p>
                <p className="text-sm">{t("addWebsiteFirst")}</p>
              </div>
            </div>
          ) : (
            <AnalyticsDashboard websiteId={selectedWebsiteId} embedded={true} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
