"use client";

import { Calendar, Clock, Eye, BookOpen } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

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
  const t = useTranslations("blog");
  const locale = useLocale();

  const formattedDate = publishedAt
    ? new Date(publishedAt).toLocaleDateString(locale, {
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
          {t("readingTimeMinutes", { count: readingTime })}
        </span>
      )}
      {wordCount && (
        <span className="flex items-center gap-1.5">
          <BookOpen className="h-4 w-4" />
          {t("wordCountChars", { count: wordCount.toLocaleString() })}
        </span>
      )}
      {totalViews !== undefined && totalViews !== null && (
        <span className="flex items-center gap-1.5">
          <Eye className="h-4 w-4" />
          {t("viewsCount", { count: totalViews.toLocaleString() })}
        </span>
      )}
    </div>
  );
}
