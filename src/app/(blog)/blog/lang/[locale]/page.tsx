/**
 * 多語系 Blog 首頁 - /blog/lang/{locale}
 *
 * 顯示特定語系的所有已翻譯文章
 * Adventure.com 風格 + 完整 SEO 優化
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAnonClient } from "@/lib/supabase/server";
import { BlogHeader, ArticleGrid } from "@/components/blog";
import {
  getBlogMeta,
  generateBlogHreflangAlternates,
} from "@/lib/i18n/blog-meta";
import type { BlogArticleListItem } from "@/types/blog";
import type { SupportedLocale } from "@/types/translations";
import { TRANSLATION_LANGUAGES } from "@/types/translations";

// 🔧 優化：ISR 快取 - 每小時重新驗證
export const revalidate = 3600;

// 使用 Anon Key 取得公開資料（安全性提升：不使用 Service Role Key）
const supabase = createAnonClient();

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * 驗證語系
 */
const VALID_LOCALES: SupportedLocale[] = [
  "zh-CN",
  "en-US",
  "ja-JP",
  "ko-KR",
  "vi-VN",
  "ms-MY",
  "th-TH",
  "id-ID",
  "tl-PH",
  "fr-FR",
  "de-DE",
  "es-ES",
  "pt-PT",
  "it-IT",
  "ru-RU",
  "ar-SA",
  "hi-IN",
];

/**
 * 靜態生成所有語系頁面
 */
export function generateStaticParams() {
  return VALID_LOCALES.map((locale) => ({ locale }));
}

/**
 * 生成 Metadata（含 hreflang + 多語系 Meta）
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;

  // 驗證語系
  if (!VALID_LOCALES.includes(locale as SupportedLocale)) {
    return { title: "Not Found" };
  }

  const meta = getBlogMeta(locale as SupportedLocale);
  const alternates = generateBlogHreflangAlternates();

  // 轉換 locale 格式（xx-XX -> xx_XX）用於 OG
  const ogLocale = locale.replace("-", "_");

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords.join(", "),
    alternates: {
      canonical: `https://1wayseo.com/blog/lang/${locale}`,
      languages: alternates,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      locale: ogLocale,
      alternateLocale: [
        "zh_TW",
        "zh_CN",
        "en_US",
        "ja_JP",
        "ko_KR",
        "vi_VN",
        "ms_MY",
        "th_TH",
        "id_ID",
        "tl_PH",
        "fr_FR",
        "de_DE",
        "es_ES",
        "pt_PT",
        "it_IT",
        "ru_RU",
        "ar_SA",
        "hi_IN",
      ].filter((l) => l !== ogLocale),
      url: `https://1wayseo.com/blog/lang/${locale}`,
      siteName: "1Way SEO",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

/**
 * 取得該語系的翻譯文章列表
 */
async function getTranslatedArticles(
  locale: SupportedLocale,
): Promise<BlogArticleListItem[]> {
  const { data } = await supabase
    .from("article_translations")
    .select(
      `
      id,
      slug,
      title,
      excerpt,
      categories,
      tags,
      reading_time,
      published_at,
      source_article:generated_articles!source_article_id (
        featured_image_url,
        article_views(total_views)
      )
    `,
    )
    .eq("target_language", locale)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(13);

  return (data || []).map((article) => {
    const sourceArticle = article.source_article as any;

    return {
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      featured_image_url: sourceArticle?.featured_image_url || null,
      categories: article.categories || [],
      tags: article.tags || [],
      reading_time: article.reading_time,
      published_at: article.published_at,
      article_views:
        sourceArticle?.article_views?.[0]?.total_views != null
          ? { total_views: sourceArticle.article_views[0].total_views }
          : null,
    };
  });
}

export default async function LocalizedBlogPage({ params }: Props) {
  const { locale } = await params;

  // 驗證語系
  if (!VALID_LOCALES.includes(locale as SupportedLocale)) {
    notFound();
  }

  const validLocale = locale as SupportedLocale;
  const articles = await getTranslatedArticles(validLocale);
  const meta = getBlogMeta(validLocale);
  const langConfig = TRANSLATION_LANGUAGES[validLocale];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Language Selector */}
        <BlogHeader
          currentLocale={validLocale}
          title={meta.pageTitle}
          subtitle={meta.pageSubtitle}
        />

        {/* Article Grid with Hero */}
        <ArticleGrid
          articles={articles}
          locale={validLocale}
          meta={meta}
          showHero={articles.length > 0}
          emptyMessage={meta.noArticles}
        />
      </div>
    </div>
  );
}
