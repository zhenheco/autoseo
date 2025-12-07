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
    <div className="mb-4 space-y-3">
      {/* 標題列 + 網站選擇器 */}
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <h1 className="text-lg md:text-xl font-bold whitespace-nowrap">
          文章管理
        </h1>
        {/* 網站選擇器 - 手機全寬，桌面固定寬度在右側 */}
        <div className="flex items-center gap-2">
          <div className="w-full md:w-[240px]">
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
        </div>
      </div>

      {/* 篩選器 - 統一顯示在標題下方左對齊 */}
      <div>{filters}</div>
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
      .filter(
        (a) =>
          a.status === "completed" ||
          a.status === "draft" ||
          a.status === "scheduled",
      )
      .map((a) => a.id);
  }, [articles]);

  const cancellableArticleIds = useMemo(() => {
    return articles
      .filter((a) => a.status === "pending" || a.status === "processing")
      .map((a) => a.id);
  }, [articles]);

  // 可刪除的文章（已取消或失敗）
  const deletableArticleIds = useMemo(() => {
    return articles
      .filter((a) => a.status === "cancelled" || a.status === "failed")
      .map((a) => a.id);
  }, [articles]);

  const selectableArticleIds = useMemo(() => {
    return [
      ...schedulableArticleIds,
      ...cancellableArticleIds,
      ...deletableArticleIds,
    ];
  }, [schedulableArticleIds, cancellableArticleIds, deletableArticleIds]);

  return (
    <ScheduleProvider>
      <PageHeader filters={filters} />
      {/*
        手機版：單欄，只顯示文章列表（預覽在點擊後以 modal 或新頁面顯示）
        平板以上：左右雙欄
      */}
      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
        {/* 文章列表區域 */}
        <div className="w-full lg:w-[45%] min-w-0 flex flex-col min-h-0">
          {/* 排程控制列 - 固定不滾動 */}
          <div className="shrink-0">
            <ScheduleControlBar
              schedulableArticleIds={schedulableArticleIds}
              cancellableArticleIds={cancellableArticleIds}
              deletableArticleIds={deletableArticleIds}
            />
          </div>
          {/* 文章列表 - 可滾動 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <ArticleList
              articles={articles}
              selectableArticleIds={selectableArticleIds}
            />
          </div>
        </div>
        {/* 預覽區域 - 手機版隱藏 */}
        <div className="hidden lg:flex lg:w-[55%] shrink-0 overflow-hidden flex-col min-h-0">
          {children}
        </div>
      </div>
    </ScheduleProvider>
  );
}
