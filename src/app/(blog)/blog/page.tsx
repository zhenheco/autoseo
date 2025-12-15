/**
 * Blog 首頁 - 簡約風格
 *
 * 多語系 SEO 優化 + 參考 todaymade.com 設計
 */

import { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { BlogHeader, ArticleGrid, BlogHero } from "@/components/blog";
import {
  getBlogMeta,
  generateBlogHreflangAlternates,
} from "@/lib/i18n/blog-meta";
import type { BlogArticleListItem } from "@/types/blog";

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 生成 Metadata（含 hreflang）
 */
export async function generateMetadata(): Promise<Metadata> {
  const meta = getBlogMeta("zh-TW");
  const alternates = generateBlogHreflangAlternates();

  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords.join(", "),
    alternates: {
      canonical: "https://1wayseo.com/blog",
      languages: alternates,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      locale: "zh_TW",
      alternateLocale: [
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
      ],
      url: "https://1wayseo.com/blog",
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
 * 取得公開文章列表
 */
async function getArticles(): Promise<BlogArticleListItem[]> {
  // 先取得平台 Blog 站點 ID
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return [];
  }

  const { data } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      slug,
      title,
      excerpt,
      featured_image_url,
      categories,
      tags,
      reading_time,
      published_at,
      article_views(total_views)
    `,
    )
    .eq("published_to_website_id", platformBlog.id)
    .eq("status", "published")
    .not("slug", "is", null)
    .order("published_at", { ascending: false })
    .limit(13); // 1 Hero + 12 Grid

  return (data || []).map((article) => ({
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    featured_image_url: article.featured_image_url,
    categories: article.categories || [],
    tags: article.tags || [],
    reading_time: article.reading_time,
    published_at: article.published_at,
    article_views:
      Array.isArray(article.article_views) && article.article_views.length > 0
        ? (article.article_views[0] as { total_views: number })
        : null,
  }));
}

export default async function BlogPage() {
  const articles = await getArticles();
  const meta = getBlogMeta("zh-TW");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <BlogHeader currentLocale="zh-TW" />

      {/* Hero 區塊 */}
      <BlogHero title={meta.pageTitle} subtitle={meta.pageSubtitle} />

      {/* 文章列表 */}
      <div className="container mx-auto px-4 py-12">
        <ArticleGrid
          articles={articles}
          locale="zh-TW"
          meta={meta}
          showHero={true}
          emptyMessage={meta.noArticles}
        />
      </div>
    </div>
  );
}
