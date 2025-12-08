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
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t("generateNewArticle")}</h1>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>📝 {t("articleSettings")}</CardTitle>
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
