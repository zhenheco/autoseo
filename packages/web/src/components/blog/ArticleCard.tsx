"use client";

import Link from "next/link";
import Image from "next/image";
import { Calendar, Clock, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BlogArticleListItem } from "@/types/blog";

interface ArticleCardProps {
  article: BlogArticleListItem;
}

/**
 * 文章卡片組件
 * 用於文章列表頁面
 */
export function ArticleCard({ article }: ArticleCardProps) {
  const formattedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Link href={`/blog/${article.slug}`}>
      <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 dark:hover:shadow-primary/5">
        {/* 封面圖片 */}
        <div className="relative aspect-video overflow-hidden bg-muted">
          {article.featured_image_url ? (
            <Image
              src={article.featured_image_url}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950 dark:to-purple-950">
              <span className="text-4xl">📝</span>
            </div>
          )}
        </div>

        <CardContent className="p-4">
          {/* 分類標籤 */}
          {article.categories && article.categories.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {article.categories.slice(0, 2).map((category) => (
                <Badge key={category} variant="secondary" className="text-xs">
                  {category}
                </Badge>
              ))}
            </div>
          )}

          {/* 標題 */}
          <h3 className="mb-2 line-clamp-2 text-lg font-semibold leading-tight transition-colors group-hover:text-primary">
            {article.title}
          </h3>

          {/* 摘要 */}
          {article.excerpt && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {article.excerpt}
            </p>
          )}

          {/* 元資訊 */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {formattedDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formattedDate}
              </span>
            )}
            {article.reading_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {article.reading_time} 分鐘
              </span>
            )}
            {article.article_views?.total_views ? (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {article.article_views.total_views.toLocaleString()} 次閱讀
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
