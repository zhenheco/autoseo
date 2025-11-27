"use client";

import { useMemo, ReactNode } from "react";
import { ScheduleProvider } from "./ScheduleContext";
import { ScheduleControlBar } from "./ScheduleControlBar";
import { ArticleList } from "./ArticleList";
import { ArticleWithWebsite } from "../actions";
import { WebsiteSelector } from "@/components/articles/WebsiteSelector";
import { useScheduleContext } from "./ScheduleContext";

interface ArticleListWrapperProps {
  articles: ArticleWithWebsite[];
  filters?: ReactNode;
  children?: ReactNode;
}

function PageHeader({ filters }: { filters?: ReactNode }) {
  const { websiteId, setWebsiteId, isScheduling } = useScheduleContext();

  return (
    <div className="mb-4 flex items-center gap-4">
      <h1 className="text-2xl font-bold whitespace-nowrap">文章管理</h1>
      <div className="w-[180px]">
        <WebsiteSelector
          value={websiteId}
          onChange={setWebsiteId}
          placeholder="選擇發布網站"
          disabled={isScheduling}
        />
      </div>
      <div className="flex-1" />
      {filters}
    </div>
  );
}

export function ArticleListWrapper({
  articles,
  filters,
  children,
}: ArticleListWrapperProps) {
  const schedulableArticleIds = useMemo(() => {
    return articles
      .filter((a) => a.status === "completed" || a.status === "draft")
      .map((a) => a.id);
  }, [articles]);

  return (
    <ScheduleProvider>
      <PageHeader filters={filters} />
      <div className="flex gap-4 h-[calc(100vh-180px)]">
        <div className="w-2/5 min-w-0 overflow-y-auto">
          <ScheduleControlBar schedulableArticleIds={schedulableArticleIds} />
          <ArticleList articles={articles} />
        </div>
        <div className="w-3/5 shrink-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </ScheduleProvider>
  );
}
