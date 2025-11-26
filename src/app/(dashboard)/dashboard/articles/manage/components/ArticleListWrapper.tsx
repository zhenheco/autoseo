"use client";

import { useMemo, ReactNode } from "react";
import { ScheduleProvider } from "./ScheduleContext";
import { ScheduleControlBar } from "./ScheduleControlBar";
import { ArticleList } from "./ArticleList";
import { ArticleWithWebsite } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import { useScheduleContext } from "./ScheduleContext";

interface ArticleListWrapperProps {
  articles: ArticleWithWebsite[];
  children?: ReactNode;
}

function PageHeader() {
  const { websiteId, setWebsiteId, isScheduling } = useScheduleContext();

  return (
    <div className="mb-6 flex items-center gap-4">
      <h1 className="text-3xl font-bold">文章管理</h1>
      <div className="w-[200px]">
        <WebsiteSelector
          value={websiteId}
          onChange={setWebsiteId}
          placeholder="選擇發布網站"
          disabled={isScheduling}
        />
      </div>
    </div>
  );
}

export function ArticleListWrapper({
  articles,
  children,
}: ArticleListWrapperProps) {
  const schedulableArticleIds = useMemo(() => {
    return articles
      .filter((a) => a.status === "completed" || a.status === "draft")
      .map((a) => a.id);
  }, [articles]);

  return (
    <ScheduleProvider>
      <PageHeader />
      <div className="flex gap-4">
        <div className="w-1/2 min-w-0">
          <Card>
            <CardContent className="pt-6">
              <ScheduleControlBar
                schedulableArticleIds={schedulableArticleIds}
              />
              <ArticleList articles={articles} />
            </CardContent>
          </Card>
        </div>
        <div className="w-1/2 shrink-0 lg:sticky lg:top-4 lg:self-start">
          {children}
        </div>
      </div>
    </ScheduleProvider>
  );
}
