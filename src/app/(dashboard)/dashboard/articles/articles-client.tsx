"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArticleFormTabs } from "./components/ArticleFormTabs";

interface QuotaStatus {
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  canUseCompetitors: boolean;
  month: string;
}

interface ArticlesClientProps {
  quotaStatus: QuotaStatus | null;
  initialWebsiteId?: string;
}

export function ArticlesClient({
  quotaStatus,
  initialWebsiteId,
}: ArticlesClientProps) {
  const t = useTranslations("articles");

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2">
            <CardTitle>📝 {t("articleSettings")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              因為我們有三十多個步驟，所以寫文章的時間會需要比較久一點，但相對文章品質會比較好，請耐心等候喔!!!
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ArticleFormTabs
            quotaStatus={quotaStatus}
            initialWebsiteId={initialWebsiteId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
