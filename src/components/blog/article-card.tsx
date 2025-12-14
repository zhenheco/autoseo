/**
 * ArticleCard - Adventure.com 風格文章卡片
 *
 * 大圖卡片設計，hover 效果，適合網格佈局
 */

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { BlogArticleListItem } from "@/types/blog";
import type { SupportedLocale } from "@/types/translations";
import type { BlogMeta } from "@/lib/i18n/blog-meta";

interface ArticleCardProps {
  article: BlogArticleListItem;
  /** 語系，用於生成連結 */
  locale?: SupportedLocale;
  /** 多語系 UI 文字 */
  meta?: BlogMeta;
  /** 卡片大小 */
  size?: "default" | "large";
}

/**
 * 格式化日期
 */
function formatDate(
  dateString: string | null,
  locale: SupportedLocale = "zh-TW",
): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const localeMap: Record<string, string> = {
    "zh-TW": "zh-TW",
    "zh-CN": "zh-CN",
    "en-US": "en-US",
    "ja-JP": "ja-JP",
    "ko-KR": "ko-KR",
    "vi-VN": "vi-VN",
    "ms-MY": "ms-MY",
    "th-TH": "th-TH",
    "id-ID": "id-ID",
    "tl-PH": "en-PH",
    "fr-FR": "fr-FR",
    "de-DE": "de-DE",
    "es-ES": "es-ES",
    "pt-PT": "pt-PT",
    "it-IT": "it-IT",
    "ru-RU": "ru-RU",
    "ar-SA": "ar-SA",
    "hi-IN": "hi-IN",
  };

  return date.toLocaleDateString(localeMap[locale] || "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * 生成文章連結
 */
function getArticleLink(slug: string, locale?: SupportedLocale): string {
  if (!locale || locale === "zh-TW") {
    return `/blog/${slug}`;
  }
  return `/blog/lang/${locale}/${slug}`;
}

export function ArticleCard({
  article,
  locale = "zh-TW",
  meta,
  size = "default",
}: ArticleCardProps) {
  const articleLink = getArticleLink(article.slug, locale);
  const minReadText = meta?.minRead || "min read";

  return (
    <article
      className={`group relative overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-300 hover:shadow-lg dark:bg-slate-900 ${
        size === "large" ? "md:col-span-2 md:row-span-2" : ""
      }`}
    >
      <Link href={articleLink} className="block">
        {/* 圖片區域 */}
        <div
          className={`relative overflow-hidden ${
            size === "large" ? "aspect-[16/9]" : "aspect-[4/3]"
          }`}
        >
          {article.featured_image_url ? (
            <Image
              src={article.featured_image_url}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes={
                size === "large"
                  ? "(max-width: 768px) 100vw, 66vw"
                  : "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              }
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700">
              <span className="text-4xl text-slate-400">1W</span>
            </div>
          )}

          {/* 漸層遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* 分類標籤 */}
          {article.categories.length > 0 && (
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              {article.categories.slice(0, 2).map((category) => (
                <Badge
                  key={category}
                  className="bg-[#E75656] text-white hover:bg-[#d14a4a]"
                >
                  {category}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* 內容區域 */}
        <div className="p-4">
          {/* 標題 */}
          <h3
            className={`mb-2 font-bold leading-tight text-slate-900 transition-colors group-hover:text-[#E75656] dark:text-white ${
              size === "large" ? "text-xl md:text-2xl" : "text-lg"
            }`}
          >
            {article.title}
          </h3>

          {/* 摘要 - 只在大卡片顯示 */}
          {size === "large" && article.excerpt && (
            <p className="mb-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
              {article.excerpt}
            </p>
          )}

          {/* Meta 資訊 */}
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <time dateTime={article.published_at || ""}>
              {formatDate(article.published_at, locale)}
            </time>
            {article.reading_time && (
              <>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span>
                  {article.reading_time} {minReadText}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
