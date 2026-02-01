"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Construction } from "lucide-react";
import { useTranslations } from "next-intl";

interface AnalyticsDashboardProps {
  websiteId: string;
  /** 嵌入模式：不渲染外層 Card */
  embedded?: boolean;
}

/**
 * 分析儀表板
 * 顯示 GSC 搜尋數據（功能開發中）
 */
export function AnalyticsDashboard({
  websiteId,
  embedded = false,
}: AnalyticsDashboardProps) {
  const t = useTranslations("dashboard");

  // 開發中狀態內容
  const renderContent = () => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4 mb-4">
        <Construction className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <h3 className="font-semibold mb-1">{t("comingSoon")}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {t("searchConsoleComingSoon")}
      </p>
    </div>
  );

  // 嵌入模式：不渲染外層 Card
  if (embedded) {
    return <div>{renderContent()}</div>;
  }

  // 原有的 Card 包裝版本
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("searchConsoleData")}
          </CardTitle>
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          >
            {t("upcoming")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}
