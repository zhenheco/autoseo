"use client";

import { useMemo } from "react";
import { ScheduleProvider } from "./ScheduleContext";
import { ScheduleControlBar } from "./ScheduleControlBar";
import { ArticleList } from "./ArticleList";
import { ArticleWithWebsite } from "../actions";

interface ArticleListWrapperProps {
  articles: ArticleWithWebsite[];
}

export function ArticleListWrapper({ articles }: ArticleListWrapperProps) {
  const schedulableArticleIds = useMemo(() => {
    return articles
      .filter((a) => a.status === "completed" || a.status === "draft")
      .map((a) => a.id);
  }, [articles]);

  return (
    <ScheduleProvider>
      <ScheduleControlBar schedulableArticleIds={schedulableArticleIds} />
      <ArticleList articles={articles} />
    </ScheduleProvider>
  );
}
