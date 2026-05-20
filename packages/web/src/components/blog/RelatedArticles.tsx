"use client";

import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import type { BlogArticleListItem } from "@/types/blog";

interface RelatedArticlesProps {
  articles: BlogArticleListItem[];
  className?: string;
}

/**
 * 相關文章組件
 * 用於文章詳情頁底部
 */
export function RelatedArticles({
  articles,
  className = "",
}: RelatedArticlesProps) {
  const t = useTranslations("blog");

  if (articles.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <h2 className="mb-6 text-2xl font-bold">{t("relatedArticles")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {articles.map((article) => (
          <Link key={article.id} href={`/blog/${article.slug}`}>
            <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
              {/* 封面圖片 */}
              <div className="relative aspect-video overflow-hidden bg-muted">
                {article.featured_image_url ? (
                  <Image
                    src={article.featured_image_url}
                    alt={article.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950 dark:to-purple-950">
                    <span className="text-2xl">📝</span>
                  </div>
                )}
              </div>

              <CardContent className="p-3">
                <h3 className="line-clamp-2 text-sm font-medium leading-tight transition-colors group-hover:text-primary">
                  {article.title}
                </h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
