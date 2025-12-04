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
    <div className="mb-4 flex items-center gap-3">
      <h1 className="text-xl font-bold whitespace-nowrap">文章管理</h1>
      <div className="flex items-center gap-2">
        <div className="w-[160px]">
          <WebsiteSelector
            value={websiteId}
            onChange={setWebsiteId}
            placeholder="選擇發布網站"
            disabled={isScheduling}
          />
        </div>
        <span className="text-orange-500 text-xs whitespace-nowrap">
          (選擇目標網站)
        </span>
        {filters}
      </div>
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
      <div className="flex gap-3 h-[calc(100vh-160px)]">
        <div className="w-[45%] min-w-0 overflow-y-auto">
          <ScheduleControlBar schedulableArticleIds={schedulableArticleIds} />
          <ArticleList articles={articles} />
        </div>
        <div className="w-[55%] shrink-0 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    </ScheduleProvider>
  );
}
