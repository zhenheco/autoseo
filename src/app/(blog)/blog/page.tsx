import { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ArticleList,
  CategoryList,
  TagCloud,
  PopularArticles,
} from "@/components/blog";
import type {
  BlogArticleListItem,
  CategoryCount,
  TagCount,
} from "@/types/blog";

export const metadata: Metadata = {
  title: "Blog | 1waySEO - SEO 教學與案例分享",
  description:
    "探索 SEO 最佳實踐、內容行銷策略和成功案例。學習如何透過 AI 驅動的內容創作提升網站排名。",
  openGraph: {
    title: "1waySEO Blog - SEO 教學與案例分享",
    description:
      "探索 SEO 最佳實踐、內容行銷策略和成功案例。學習如何透過 AI 驅動的內容創作提升網站排名。",
    type: "website",
    locale: "zh_TW",
  },
};

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

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
    .limit(12);

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
 * 取得分類列表
 */
async function getCategories(): Promise<CategoryCount[]> {
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
    .select("categories")
    .eq("published_to_website_id", platformBlog.id)
    .eq("status", "published")
    .not("categories", "is", null);

  const categoryCountMap = new Map<string, number>();

  for (const article of data || []) {
    for (const category of article.categories || []) {
      if (category) {
        categoryCountMap.set(
          category,
          (categoryCountMap.get(category) || 0) + 1,
        );
      }
    }
  }

  return Array.from(categoryCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 取得標籤列表
 */
async function getTags(): Promise<TagCount[]> {
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
    .select("tags")
    .eq("published_to_website_id", platformBlog.id)
    .eq("status", "published")
    .not("tags", "is", null);

  const tagCountMap = new Map<string, number>();

  for (const article of data || []) {
    for (const tag of article.tags || []) {
      if (tag) {
        tagCountMap.set(tag, (tagCountMap.get(tag) || 0) + 1);
      }
    }
  }

  return Array.from(tagCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 取得熱門文章
 */
async function getPopularArticles(): Promise<BlogArticleListItem[]> {
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
    .limit(20);

  // 在記憶體中按閱讀數排序
  const sorted = (data || [])
    .map((article) => ({
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
    }))
    .sort((a, b) => {
      const viewsA = a.article_views?.total_views || 0;
      const viewsB = b.article_views?.total_views || 0;
      return viewsB - viewsA;
    })
    .slice(0, 5);

  return sorted;
}

export default async function BlogPage() {
  const [articles, categories, tags, popularArticles] = await Promise.all([
    getArticles(),
    getCategories(),
    getTags(),
    getPopularArticles(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 頁面標題 */}
      <div className="mb-8 text-center">
        <h1 className="mb-4 text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          SEO 教學與案例分享
        </h1>
        <p className="text-lg text-muted-foreground">
          探索 SEO 最佳實踐、內容行銷策略和成功案例
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 主要內容區 */}
        <div className="flex-1">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            }
          >
            <ArticleList
              articles={articles}
              emptyMessage="目前還沒有文章，敬請期待！"
            />
          </Suspense>
        </div>

        {/* 側邊欄 */}
        <aside className="w-full space-y-8 lg:w-72">
          {/* 分類 */}
          <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
            <CategoryList categories={categories} />
          </div>

          {/* 熱門文章 */}
          {popularArticles.length > 0 && (
            <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
              <PopularArticles articles={popularArticles} />
            </div>
          )}

          {/* 標籤雲 */}
          <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
            <TagCloud tags={tags} />
          </div>
        </aside>
      </div>
    </div>
  );
}
