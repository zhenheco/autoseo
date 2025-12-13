"use client";

import { ArticleCard } from "./ArticleCard";
import type { BlogArticleListItem } from "@/types/blog";

interface ArticleListProps {
  articles: BlogArticleListItem[];
  emptyMessage?: string;
}

/**
 * 文章列表組件
 * 以網格形式展示文章卡片
 */
export function ArticleList({
  articles,
  emptyMessage = "目前沒有文章",
}: ArticleListProps) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="mb-4 text-6xl">📭</span>
        <p className="text-lg text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
