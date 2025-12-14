import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArticleMeta,
  RelatedArticles,
  ViewCounter,
  ArticleSchema,
  BreadcrumbSchema,
} from "@/components/blog";
import { LanguageSwitcher } from "@/components/blog/language-switcher";
import type { BlogArticle, BlogArticleListItem } from "@/types/blog";
import type { SupportedLocale, HreflangEntry } from "@/types/translations";

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface Props {
  params: Promise<{ locale: SupportedLocale; slug: string }>;
}

/**
 * 取得文章詳情（支援多語系）
 */
async function getArticle(
  locale: SupportedLocale,
  slug: string,
): Promise<BlogArticle | null> {
  // 先取得平台 Blog 站點 ID
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return null;
  }

  // 如果是中文，從原始文章取得
  if (locale === "zh-TW") {
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

    return formatArticle(data);
  }

  // 其他語言，從翻譯表取得
  const { data } = await supabase
    .from("article_translations")
    .select(
      `
      id,
      slug,
      title,
      excerpt,
      html_content,
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
      source_article:generated_articles!source_article_id (
        featured_image_url,
        featured_image_alt,
        og_image,
        article_views(total_views, views_this_week)
      )
    `,
    )
    .eq("target_language", locale)
    .eq("status", "published")
    .eq("slug", slug)
    .single();

  if (!data) {
    return null;
  }

  const sourceArticle = data.source_article as any;

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    html_content: data.html_content,
    featured_image_url: sourceArticle?.featured_image_url || null,
    featured_image_alt: sourceArticle?.featured_image_alt || null,
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
    og_image: sourceArticle?.og_image || null,
    article_views:
      Array.isArray(sourceArticle?.article_views) &&
      sourceArticle.article_views.length > 0
        ? sourceArticle.article_views[0]
        : null,
  };
}

/**
 * 格式化文章資料
 */
function formatArticle(data: any): BlogArticle {
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
        ? data.article_views[0]
        : null,
  };
}

/**
 * 取得文章的所有語言版本
 * 注意：URL 使用 /blog/lang/{locale}/{slug} 格式
 */
async function getAvailableTranslations(
  locale: SupportedLocale,
  slug: string,
): Promise<HreflangEntry[]> {
  const entries: HreflangEntry[] = [];
  const baseUrl = "https://1wayseo.com";

  // 先找到原始文章 ID
  let sourceArticleId: string | null = null;
  let originalSlug: string | null = null;

  if (locale === "zh-TW") {
    // 當前是中文版，直接查詢
    const { data } = await supabase
      .from("generated_articles")
      .select("id, slug")
      .eq("slug", slug)
      .single();

    if (data) {
      sourceArticleId = data.id;
      originalSlug = data.slug;
    }
  } else {
    // 當前是翻譯版，找原文
    const { data } = await supabase
      .from("article_translations")
      .select(
        `
        source_article_id,
        generated_articles!source_article_id (
          slug
        )
      `,
      )
      .eq("target_language", locale)
      .eq("slug", slug)
      .single();

    if (data) {
      sourceArticleId = data.source_article_id;
      originalSlug = (data.generated_articles as any)?.slug || null;
    }
  }

  if (!sourceArticleId || !originalSlug) {
    return entries;
  }

  // 加入原文（中文）- 使用舊路由 /blog/{slug} 保持向後兼容
  entries.push({
    locale: "zh-TW",
    url: `${baseUrl}/blog/${originalSlug}`,
  });

  // 查詢所有翻譯版本
  const { data: translations } = await supabase
    .from("article_translations")
    .select("target_language, slug")
    .eq("source_article_id", sourceArticleId)
    .eq("status", "published");

  if (translations) {
    for (const t of translations) {
      // 翻譯版本使用新路由 /blog/lang/{locale}/{slug}
      entries.push({
        locale: t.target_language as SupportedLocale,
        url: `${baseUrl}/blog/lang/${t.target_language}/${t.slug}`,
      });
    }
  }

  return entries;
}

/**
 * 取得相關文章
 */
async function getRelatedArticles(
  articleId: string,
  categories: string[],
  locale: SupportedLocale,
): Promise<BlogArticleListItem[]> {
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return [];
  }

  // 只取得同語言的相關文章
  if (locale === "zh-TW") {
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
          ? article.article_views[0]
          : null,
    }));
  }

  // 翻譯版本的相關文章
  let query = supabase
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
        featured_image_url
      )
    `,
    )
    .eq("target_language", locale)
    .eq("status", "published")
    .neq("id", articleId)
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
    featured_image_url: (article.source_article as any)?.featured_image_url,
    categories: article.categories || [],
    tags: article.tags || [],
    reading_time: article.reading_time,
    published_at: article.published_at,
    article_views: null,
  }));
}

/**
 * 取得語言標籤
 */
function getLocaleLabel(locale: SupportedLocale): string {
  const labels: Record<SupportedLocale, string> = {
    "zh-TW": "返回文章列表",
    "en-US": "Back to Articles",
    "de-DE": "Zurück zur Artikelliste",
    "fr-FR": "Retour aux articles",
    "es-ES": "Volver a artículos",
  };
  return labels[locale] || labels["en-US"];
}

function getTagLabel(locale: SupportedLocale): string {
  const labels: Record<SupportedLocale, string> = {
    "zh-TW": "標籤：",
    "en-US": "Tags:",
    "de-DE": "Tags:",
    "fr-FR": "Tags:",
    "es-ES": "Etiquetas:",
  };
  return labels[locale] || labels["en-US"];
}

/**
 * 動態生成 Metadata
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const article = await getArticle(locale, slug);
  const translations = await getAvailableTranslations(locale, slug);

  if (!article) {
    return {
      title: "Article Not Found | 1waySEO Blog",
    };
  }

  const title = article.seo_title || article.title;
  const description =
    article.seo_description || article.excerpt || `Read ${article.title}`;

  // 建立 hreflang alternates
  const languages: Record<string, string> = {};
  for (const entry of translations) {
    languages[entry.locale] = entry.url;
  }

  // x-default 指向中文版
  const zhEntry = translations.find((t) => t.locale === "zh-TW");
  if (zhEntry) {
    languages["x-default"] = zhEntry.url;
  }

  return {
    title: `${title} | 1waySEO Blog`,
    description,
    keywords: article.keywords?.join(", ") || article.focus_keyword,
    alternates: {
      canonical: `https://1wayseo.com/blog/lang/${locale}/${slug}`,
      languages,
    },
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
      locale: locale.replace("-", "_"),
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

export default async function LocalizedArticlePage({ params }: Props) {
  const { locale, slug } = await params;

  // 驗證 locale
  const validLocales: SupportedLocale[] = [
    "zh-TW",
    "en-US",
    "de-DE",
    "fr-FR",
    "es-ES",
  ];
  if (!validLocales.includes(locale)) {
    notFound();
  }

  const article = await getArticle(locale, slug);

  if (!article) {
    notFound();
  }

  const [relatedArticles, translations] = await Promise.all([
    getRelatedArticles(article.id, article.categories, locale),
    getAvailableTranslations(locale, slug),
  ]);

  const articleUrl = `https://1wayseo.com/blog/lang/${locale}/${article.slug}`;

  return (
    <>
      {/* Schema.org 結構化資料 */}
      <ArticleSchema article={article} url={articleUrl} locale={locale} />
      <BreadcrumbSchema
        title={article.title}
        url={articleUrl}
        locale={locale}
        category={article.categories?.[0]}
      />

      <article className="container mx-auto px-4 py-8">
        {/* 頂部導航 */}
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/blog`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {getLocaleLabel(locale)}
            </Button>
          </Link>

          {/* 語言切換器 */}
          {translations.length > 1 && (
            <LanguageSwitcher
              currentLocale={locale}
              translations={translations}
            />
          )}
        </div>

        {/* 文章頭部 */}
        <header className="mx-auto mb-8 max-w-4xl">
          {/* 分類 */}
          {article.categories.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {article.categories.map((category) => (
                <Link
                  key={category}
                  href={`/blog/category/${encodeURIComponent(category)}`}
                >
                  <Badge variant="secondary">{category}</Badge>
                </Link>
              ))}
            </div>
          )}

          {/* 標題 */}
          <h1 className="mb-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {article.title}
          </h1>

          {/* 元資訊 */}
          <div className="mb-6 flex flex-wrap items-center gap-4 text-muted-foreground">
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

          {/* 封面圖片 */}
          {article.featured_image_url && (
            <div className="relative mb-8 aspect-video overflow-hidden rounded-xl">
              <Image
                src={article.featured_image_url}
                alt={article.featured_image_alt || article.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 60vw"
              />
            </div>
          )}
        </header>

        {/* 文章內容 */}
        <div className="mx-auto max-w-4xl">
          <div
            className="prose prose-lg dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-a:text-primary prose-img:rounded-lg"
            dangerouslySetInnerHTML={{ __html: article.html_content }}
          />
        </div>

        {/* 標籤 */}
        {article.tags.length > 0 && (
          <div className="mx-auto mt-8 max-w-4xl border-t pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {getTagLabel(locale)}
              </span>
              {article.tags.map((tag) => (
                <Link key={tag} href={`/blog/tag/${encodeURIComponent(tag)}`}>
                  <Badge variant="outline" className="cursor-pointer">
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 相關文章 */}
        {relatedArticles.length > 0 && (
          <div className="mx-auto mt-12 max-w-6xl border-t pt-12">
            <RelatedArticles articles={relatedArticles} />
          </div>
        )}
      </article>
    </>
  );
}
