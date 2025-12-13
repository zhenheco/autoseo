"use client";

import { Calendar, Clock, Eye, BookOpen } from "lucide-react";

interface ArticleMetaProps {
  publishedAt: string | null;
  readingTime: number | null;
  wordCount: number | null;
  totalViews?: number | null;
  className?: string;
}

/**
 * 文章元資訊組件
 * 顯示發布時間、閱讀時間、字數、閱讀次數
 */
export function ArticleMeta({
  publishedAt,
  readingTime,
  wordCount,
  totalViews,
  className = "",
}: ArticleMetaProps) {
  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div
      className={`flex flex-wrap items-center gap-4 text-sm text-muted-foreground ${className}`}
    >
      {formattedDate && (
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          {formattedDate}
        </span>
      )}
      {readingTime && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {readingTime} 分鐘閱讀
        </span>
      )}
      {wordCount && (
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" />
          {wordCount.toLocaleString()} 字
        </span>
      )}
      {totalViews !== undefined && totalViews !== null && (
        <span className="flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          {totalViews.toLocaleString()} 次閱讀
        </span>
      )}
    </div>
  );
}
