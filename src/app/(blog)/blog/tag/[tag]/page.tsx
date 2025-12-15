import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Tags } from "lucide-react";
import { ArticleGrid, CategoryList, TagCloud } from "@/components/blog";
import type {
  BlogArticleListItem,
  CategoryCount,
  TagCount,
} from "@/types/blog";

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface Props {
  params: Promise<{ tag: string }>;
}

/**
 * 取得標籤下的文章
 */
async function getArticlesByTag(tag: string): Promise<BlogArticleListItem[]> {
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
    .contains("tags", [tag])
    .not("slug", "is", null)
    .order("published_at", { ascending: false });

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
 * 取得所有分類
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
    for (const cat of article.categories || []) {
      if (cat) {
        categoryCountMap.set(cat, (categoryCountMap.get(cat) || 0) + 1);
      }
    }
  }

  return Array.from(categoryCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 取得所有標籤
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
    for (const t of article.tags || []) {
      if (t) {
        tagCountMap.set(t, (tagCountMap.get(t) || 0) + 1);
      }
    }
  }

  return Array.from(tagCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * 動態生成 Metadata
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  return {
    title: `#${decodedTag} | 1waySEO Blog`,
    description: `探索標籤「${decodedTag}」相關的 SEO 教學和案例文章`,
    openGraph: {
      title: `#${decodedTag} - 1waySEO Blog`,
      description: `探索標籤「${decodedTag}」相關的 SEO 教學和案例文章`,
      type: "website",
      locale: "zh_TW",
    },
  };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const decodedTag = decodeURIComponent(tag);

  const [articles, categories, tags] = await Promise.all([
    getArticlesByTag(decodedTag),
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <nav className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-[#8b5cf6] transition-colors hover:text-[#7c3aed]"
          >
            1Way<span className="text-slate-900 dark:text-white">SEO</span>
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            ← 返回 Blog
          </Link>
        </nav>
      </header>

      {/* 頁面標題 */}
      <div className="py-12 bg-gradient-to-b from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400 mb-3">
            <Tags className="h-5 w-5" />
            <span className="text-sm font-medium">標籤</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-2">
            #{decodedTag}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            共 {articles.length} 篇文章
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="flex flex-col gap-12 lg:flex-row">
          {/* 主要內容區 */}
          <div className="flex-1">
            <ArticleGrid
              articles={articles}
              showHero={false}
              emptyMessage={`標籤「${decodedTag}」目前沒有文章`}
            />
          </div>

          {/* 側邊欄 */}
          <aside className="w-full space-y-6 lg:w-72 shrink-0">
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <CategoryList categories={categories} />
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
              <TagCloud tags={tags} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
