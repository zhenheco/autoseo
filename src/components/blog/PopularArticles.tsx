"use client";

import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BlogArticleListItem } from "@/types/blog";

interface PopularArticlesProps {
  articles: BlogArticleListItem[];
  className?: string;
}

/**
 * 熱門文章組件
 * 用於側邊欄顯示最多閱讀的文章
 */
export function PopularArticles({
  articles,
  className = "",
}: PopularArticlesProps) {
  const t = useTranslations("blog");

  if (articles.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <TrendingUp className="h-5 w-5" />
        {t("popularArticles")}
      </h3>
      <div className="space-y-4">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/blog/${article.slug}`}
            className="group flex gap-3"
          >
            {/* 排名數字 */}
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              {/* 標題 */}
              <h4 className="line-clamp-2 text-sm font-medium leading-tight transition-colors group-hover:text-primary">
                {article.title}
              </h4>

              {/* 閱讀數 */}
              {article.article_views?.total_views ? (
                <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="h-3 w-3" />
                  {t("views", { count: article.article_views.total_views.toLocaleString() })}
                </span>
              ) : null}
            </div>

            {/* 縮圖 */}
            {article.featured_image_url && (
              <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                <Image
                  src={article.featured_image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
