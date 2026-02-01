import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { createAnonClient } from "@/lib/supabase/server";
import {
  ArticleMeta,
  RelatedArticles,
  ViewCounter,
  ArticleSchema,
  BreadcrumbSchema,
  LanguageSwitcher,
} from "@/components/blog";
import { ArticleHtmlPreview } from "@/components/article/ArticleHtmlPreview";
import { ArticleTOC } from "@/components/article/ArticleTOC";
import type { BlogArticle, BlogArticleListItem } from "@/types/blog";
import type { HreflangEntry, SupportedLocale } from "@/types/translations";
import { getTranslations } from "next-intl/server";

// 🔧 優化：ISR 快取 - 每小時重新驗證
export const revalidate = 3600;

// 使用 Anon Key 取得公開資料（安全性提升：不使用 Service Role Key）
const supabase = createAnonClient();

interface Props {
  params: Promise<{ slug: string }>;
}

/**
 * 取得文章詳情
 */
async function getArticle(slug: string): Promise<BlogArticle | null> {
  // 先取得平台 Blog 站點 ID
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return null;
  }

  const { data } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      slug,
      title,
      excerpt,
      html_content,
      featured_image_url,
      featured_image_alt,
      categories,
      tags,
      reading_time,
      word_count,
      published_at,
      created_at,
      updated_at,
      seo_title,
      seo_description,
      focus_keyword,
      keywords,
      og_title,
      og_description,
      og_image,
      article_views(total_views, views_this_week)
    `,
    )
    .eq("published_to_website_id", platformBlog.id)
    .eq("status", "published")
    .eq("slug", slug)
    .single();

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    html_content: data.html_content,
    featured_image_url: data.featured_image_url,
    featured_image_alt: data.featured_image_alt,
    categories: data.categories || [],
    tags: data.tags || [],
    reading_time: data.reading_time,
    word_count: data.word_count,
    published_at: data.published_at,
    created_at: data.created_at,
    updated_at: data.updated_at,
    seo_title: data.seo_title,
    seo_description: data.seo_description,
    focus_keyword: data.focus_keyword,
    keywords: data.keywords,
    og_title: data.og_title,
    og_description: data.og_description,
    og_image: data.og_image,
    article_views:
      Array.isArray(data.article_views) && data.article_views.length > 0
        ? (data.article_views[0] as {
            total_views: number;
            views_this_week: number;
          })
        : null,
  };
}

/**
 * 取得相關文章
 */
async function getRelatedArticles(
  articleId: string,
  categories: string[],
): Promise<BlogArticleListItem[]> {
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return [];
  }

  let query = supabase
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
    .neq("id", articleId)
    .not("slug", "is", null)
    .limit(4);

  if (categories.length > 0) {
    query = query.overlaps("categories", categories);
  }

  const { data } = await query;

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

/**
 * 取得文章的翻譯版本
 */
async function getArticleTranslations(
  articleId: string,
  originalSlug: string,
): Promise<HreflangEntry[]> {
  const { data } = await supabase
    .from("article_translations")
    .select("target_language, slug")
    .eq("source_article_id", articleId)
    .eq("status", "published");

  if (!data || data.length === 0) {
    return [];
  }

  // 構建 hreflang 項目
  const translations: HreflangEntry[] = [
    // 原文（繁體中文）
    { locale: "zh-TW" as SupportedLocale, url: `/blog/${originalSlug}` },
  ];

  // 添加翻譯版本
  data.forEach((t) => {
    translations.push({
      locale: t.target_language as SupportedLocale,
      url: `/blog/lang/${t.target_language}/${t.slug}`,
    });
  });

  return translations;
}

/**
 * 動態生成 Metadata
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  const t = await getTranslations("blog");

  if (!article) {
    return {
      title: `${t("articleNotFound")} | 1waySEO Blog`,
    };
  }

  const title = article.seo_title || article.title;
  const description =
    article.seo_description || article.excerpt || t("read", { title: article.title });

  return {
    title: `${title} | 1waySEO Blog`,
    description,
    keywords: article.keywords?.join(", ") || article.focus_keyword,
    openGraph: {
      title: article.og_title || title,
      description: article.og_description || description,
      type: "article",
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at,
      images:
        article.og_image || article.featured_image_url
          ? [{ url: article.og_image || article.featured_image_url! }]
          : [],
      locale: "zh_TW",
    },
    twitter: {
      card: "summary_large_image",
      title: article.og_title || title,
      description: article.og_description || description,
      images:
        article.og_image || article.featured_image_url
          ? [article.og_image || article.featured_image_url!]
          : [],
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);
  const t = await getTranslations("blog");

  if (!article) {
    notFound();
  }

  const relatedArticles = await getRelatedArticles(
    article.id,
    article.categories,
  );

  // 取得翻譯版本（用於語系切換）
  const translations = await getArticleTranslations(article.id, article.slug);

  const articleUrl = `https://1wayseo.com/blog/${article.slug}`;

  return (
    <>
      {/* Schema.org 結構化資料 */}
      <ArticleSchema article={article} url={articleUrl} locale="zh-TW" />
      <BreadcrumbSchema
        title={article.title}
        url={articleUrl}
        locale="zh-TW"
        category={article.categories?.[0]}
      />

      <article className="container mx-auto px-4 py-12">
        {/* 文章頭部 */}
        <header className="mx-auto mb-12 max-w-3xl">
          {/* 語系切換（只有存在翻譯版本時才顯示）*/}
          {translations.length > 1 && (
            <div className="mb-6 flex justify-end">
              <LanguageSwitcher
                currentLocale="zh-TW"
                translations={translations}
              />
            </div>
          )}

          {/* 分類 */}
          {article.categories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {article.categories.map((category) => (
                <Link
                  key={category}
                  href={`/blog/category/${encodeURIComponent(category)}`}
                >
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300"
                  >
                    {category}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* 標題 */}
          <h1 className="mb-6 text-3xl font-bold leading-tight text-slate-900 dark:text-white sm:text-4xl lg:text-[42px]">
            {article.title}
          </h1>

          {/* 元資訊 */}
          <div className="flex flex-wrap items-center gap-4 text-slate-500 dark:text-slate-400">
            <ArticleMeta
              publishedAt={article.published_at}
              readingTime={article.reading_time}
              wordCount={article.word_count}
            />
            <ViewCounter
              articleId={article.id}
              initialViews={article.article_views?.total_views || 0}
              className="text-sm"
            />
          </div>
        </header>

        {/* 封面圖片 - 滿版 */}
        {article.featured_image_url && (
          <div className="mx-auto mb-12 max-w-4xl">
            <div className="relative aspect-video overflow-hidden rounded-xl shadow-lg">
              <Image
                src={article.featured_image_url}
                alt={article.featured_image_alt || article.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
              />
            </div>
          </div>
        )}

        {/* 內文 + TOC */}
        <div className="relative flex justify-center gap-12">
          {/* 主內容 */}
          <div className="max-w-3xl flex-1 min-w-0">
            <ArticleHtmlPreview
              htmlContent={article.html_content}
              featuredImageUrl={article.featured_image_url ?? undefined}
            />

            {/* 標籤 */}
            {article.tags.length > 0 && (
              <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t("tags")}
                  </span>
                  {article.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog/tag/${encodeURIComponent(tag)}`}
                    >
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        {tag}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* TOC 側邊欄（xl 以上顯示）*/}
          <aside className="hidden xl:block w-64 shrink-0 self-start">
            <div className="sticky top-24">
              <ArticleTOC htmlContent={article.html_content} />
            </div>
          </aside>
        </div>

        {/* 相關文章 */}
        {relatedArticles.length > 0 && (
          <div className="mx-auto mt-16 max-w-6xl border-t border-slate-200 dark:border-slate-700 pt-12">
            <RelatedArticles articles={relatedArticles} />
          </div>
        )}
      </article>
    </>
  );
}
