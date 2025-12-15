/**
 * ArticleGrid - 簡約風格文章網格
 *
 * 響應式網格佈局：桌面 3 欄，平板 2 欄，手機 1 欄
 * 參考 todaymade.com 設計
 */

import { ArticleCard } from "./article-card";
import { HeroArticle } from "./hero-article";
import type { BlogArticleListItem } from "@/types/blog";
import type { SupportedLocale } from "@/types/translations";
import type { BlogMeta } from "@/lib/i18n/blog-meta";

interface ArticleGridProps {
  /** 文章列表 */
  articles: BlogArticleListItem[];
  /** 語系 */
  locale?: SupportedLocale;
  /** 多語系 UI 文字 */
  meta?: BlogMeta;
  /** 是否顯示 Hero（精選文章） */
  showHero?: boolean;
  /** 沒有文章時的訊息 */
  emptyMessage?: string;
}

export function ArticleGrid({
  articles,
  locale = "zh-TW",
  meta,
  showHero = true,
  emptyMessage,
}: ArticleGridProps) {
  const noArticlesText =
    emptyMessage || meta?.noArticles || "No articles available";

  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 text-6xl">📝</div>
        <p className="text-lg text-slate-500 dark:text-slate-400">
          {noArticlesText}
        </p>
      </div>
    );
  }

  // 分離精選文章和其他文章
  const [featuredArticle, ...otherArticles] = articles;

  return (
    <div className="space-y-8">
      {/* Hero 精選文章 */}
      {showHero && featuredArticle && (
        <section>
          <HeroArticle article={featuredArticle} locale={locale} meta={meta} />
        </section>
      )}

      {/* 最新文章區塊標題 */}
      {meta?.latestLabel && otherArticles.length > 0 && (
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {meta.latestLabel}
          </h2>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
      )}

      {/* 文章網格 */}
      {(showHero ? otherArticles : articles).length > 0 && (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {(showHero ? otherArticles : articles).map((article, index) => (
            <ArticleCard
              key={article.id}
              article={article}
              locale={locale}
              meta={meta}
              // 第一篇文章可以設為大卡片（如果不顯示 Hero）
              size={!showHero && index === 0 ? "large" : "default"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
