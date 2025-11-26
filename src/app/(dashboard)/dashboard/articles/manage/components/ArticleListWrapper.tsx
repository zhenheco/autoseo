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
