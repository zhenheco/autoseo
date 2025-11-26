"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QuickArticleForm } from "./QuickArticleForm";
import { ArticleForm } from "./ArticleForm";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import Link from "next/link";

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
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="website">目標網站 *</Label>
        <WebsiteSelector
          value={selectedWebsiteId}
          onChange={setSelectedWebsiteId}
          placeholder="選擇要發布文章的網站"
        />
        <p className="text-sm text-muted-foreground">生成的文章將屬於此網站</p>
      </div>

      {!selectedWebsiteId && (
        <Alert>
          <AlertDescription>
            請先選擇目標網站，或
            <Link
              href="/dashboard/websites/new"
              className="underline mx-1 font-medium"
            >
              新增網站
            </Link>
            後再生成文章
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="quick" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quick" disabled={!selectedWebsiteId}>
            快速生成
          </TabsTrigger>
          <TabsTrigger value="advanced" disabled={!selectedWebsiteId}>
            進階生成
          </TabsTrigger>
        </TabsList>
        <TabsContent value="quick" className="mt-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              輸入關鍵字快速生成文章，適合一般使用需求
            </div>
            <QuickArticleForm
              quotaStatus={quotaStatus}
              websiteId={selectedWebsiteId}
            />
          </div>
        </TabsContent>
        <TabsContent value="advanced" className="mt-6">
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              設定產業、地區、語言等參數，獲得更精準的 SEO 優化文章
            </div>
            <ArticleForm
              quotaStatus={quotaStatus}
              websiteId={selectedWebsiteId}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
