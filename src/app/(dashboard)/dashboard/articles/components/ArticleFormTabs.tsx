"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { QuickArticleForm } from "./QuickArticleForm";
import { ArticleForm } from "./ArticleForm";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";

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
  initialWebsiteId?: string;
}

export function ArticleFormTabs({
  quotaStatus,
  initialWebsiteId,
}: ArticleFormTabsProps) {
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(
    initialWebsiteId || null,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="website">目標網站</Label>
          <WebsiteSelector
            value={selectedWebsiteId}
            onChange={setSelectedWebsiteId}
            allowNoWebsite={true}
            placeholder="選擇網站（選填）"
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-4 space-y-3">
          <h4 className="font-medium text-sm">💡 使用說明</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• 不選擇網站也可生成文章</li>
            <li>• 稍後可在「文章管理」決定發布目標</li>
            <li>• 快速生成：輸入關鍵字即可</li>
            <li>• 進階生成：可設定產業和標題模式</li>
          </ul>
        </div>
      </div>

      <div className="lg:col-span-8">
        <Tabs defaultValue="quick" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">快速生成</TabsTrigger>
            <TabsTrigger value="advanced">進階生成</TabsTrigger>
          </TabsList>
          <TabsContent value="quick" className="mt-4">
            <QuickArticleForm
              quotaStatus={quotaStatus}
              websiteId={selectedWebsiteId}
            />
          </TabsContent>
          <TabsContent value="advanced" className="mt-4">
            <ArticleForm websiteId={selectedWebsiteId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
