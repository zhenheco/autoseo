"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuickArticleForm } from "./QuickArticleForm";
import { ArticleForm } from "./ArticleForm";

interface QuotaStatus {
  plan: string;
  quota: number;
  used: number;
  remaining: number;
  canUseCompetitors: boolean;
  month: string;
}

interface ArticleFormTabsProps {
  quotaStatus: QuotaStatus | null;
}

export function ArticleFormTabs({ quotaStatus }: ArticleFormTabsProps) {
  return (
    <Tabs defaultValue="quick" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="quick">快速生成</TabsTrigger>
        <TabsTrigger value="advanced">進階生成</TabsTrigger>
      </TabsList>
      <TabsContent value="quick" className="mt-6">
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            輸入關鍵字快速生成文章，適合一般使用需求
          </div>
          <QuickArticleForm quotaStatus={quotaStatus} />
        </div>
      </TabsContent>
      <TabsContent value="advanced" className="mt-6">
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            設定產業、地區、語言等參數，獲得更精準的 SEO 優化文章
          </div>
          <ArticleForm quotaStatus={quotaStatus} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
