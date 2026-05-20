/**
 * HeroArticle - Adventure.com 風格精選文章
 *
 * 全寬 hero 圖片，文字疊加在圖片上
 */

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";
import type { BlogArticleListItem } from "@/types/blog";
import type { SupportedLocale } from "@/types/translations";
import type { BlogMeta } from "@/lib/i18n/blog-meta";

interface HeroArticleProps {
  article: BlogArticleListItem;
  /** 語系，用於生成連結 */
  locale?: SupportedLocale;
  /** 多語系 UI 文字 */
  meta?: BlogMeta;
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
    month: "long",
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

export function HeroArticle({
  article,
  locale = "zh-TW",
  meta,
}: HeroArticleProps) {
  const articleLink = getArticleLink(article.slug, locale);
  const featuredLabel = meta?.featuredLabel || "Featured";
  const readMoreText = meta?.readMore || "Read More";
  const minReadText = meta?.minRead || "min read";

  return (
    <article className="group relative overflow-hidden rounded-2xl">
      <Link href={articleLink} className="block">
        {/* 全寬背景圖 */}
        <div className="relative aspect-[21/9] md:aspect-[3/1]">
          {article.featured_image_url ? (
            <Image
              src={article.featured_image_url}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              sizes="100vw"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <span className="text-6xl font-bold text-slate-700">
                1Way SEO
              </span>
            </div>
          )}

          {/* 漸層遮罩 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

          {/* 內容 */}
          <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 lg:p-12">
            {/* Featured 標籤 */}
            <Badge className="mb-4 w-fit bg-[#E75656] text-white hover:bg-[#d14a4a]">
              {featuredLabel}
            </Badge>

            {/* 分類 */}
            {article.categories.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {article.categories.slice(0, 3).map((category) => (
                  <span
                    key={category}
                    className="text-sm font-medium text-white/80"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}

            {/* 標題 */}
            <h2 className="mb-3 max-w-3xl text-2xl font-bold leading-tight text-white transition-colors group-hover:text-[#E75656] md:text-3xl lg:text-4xl">
              {article.title}
            </h2>

            {/* 摘要 */}
            {article.excerpt && (
              <p className="mb-4 hidden max-w-2xl text-base text-white/80 md:line-clamp-2 md:block">
                {article.excerpt}
              </p>
            )}

            {/* Meta + CTA */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3 text-sm text-white/70">
                <time dateTime={article.published_at || ""}>
                  {formatDate(article.published_at, locale)}
                </time>
                {article.reading_time && (
                  <>
                    <span className="text-white/50">|</span>
                    <span>
                      {article.reading_time} {minReadText}
                    </span>
                  </>
                )}
              </div>

              {/* Read More 按鈕 */}
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all group-hover:bg-[#E75656] group-hover:text-white">
                {readMoreText}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
