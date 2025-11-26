"use client";

import { useMemo, ReactNode } from "react";
import { ScheduleProvider } from "./ScheduleContext";
import { ScheduleControlBar } from "./ScheduleControlBar";
import { ArticleList } from "./ArticleList";
import { ArticleWithWebsite } from "../actions";
import { Card, CardContent } from "@/components/ui/card";

interface ArticleListWrapperProps {
  articles: ArticleWithWebsite[];
  children?: ReactNode;
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <ScheduleControlBar schedulableArticleIds={schedulableArticleIds} />
            <ArticleList articles={articles} />
          </CardContent>
        </Card>
        <div className="lg:sticky lg:top-4 lg:self-start">{children}</div>
      </div>
    </ScheduleProvider>
  );
}
