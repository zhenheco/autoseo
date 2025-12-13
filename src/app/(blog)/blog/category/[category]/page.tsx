import { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArticleList, CategoryList, TagCloud } from "@/components/blog";
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
  params: Promise<{ category: string }>;
}

/**
 * 取得分類下的文章
 */
async function getArticlesByCategory(
  category: string,
): Promise<BlogArticleListItem[]> {
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
    .contains("categories", [category])
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
 * 動態生成 Metadata
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const decodedCategory = decodeURIComponent(category);

  return {
    title: `${decodedCategory} | 1waySEO Blog`,
    description: `探索 ${decodedCategory} 相關的 SEO 教學和案例文章`,
    openGraph: {
      title: `${decodedCategory} - 1waySEO Blog`,
      description: `探索 ${decodedCategory} 相關的 SEO 教學和案例文章`,
      type: "website",
      locale: "zh_TW",
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const decodedCategory = decodeURIComponent(category);

  const [articles, categories, tags] = await Promise.all([
    getArticlesByCategory(decodedCategory),
    getCategories(),
    getTags(),
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 返回按鈕 */}
      <div className="mb-6">
        <Link href="/blog">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回文章列表
          </Button>
        </Link>
      </div>

      {/* 頁面標題 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <FolderOpen className="h-5 w-5" />
          <span>分類</span>
        </div>
        <h1 className="text-3xl font-bold">{decodedCategory}</h1>
        <p className="mt-2 text-muted-foreground">
          共 {articles.length} 篇文章
        </p>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* 主要內容區 */}
        <div className="flex-1">
          <ArticleList
            articles={articles}
            emptyMessage={`「${decodedCategory}」分類目前沒有文章`}
          />
        </div>

        {/* 側邊欄 */}
        <aside className="w-full space-y-8 lg:w-72">
          <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
            <CategoryList categories={categories} />
          </div>
          <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
            <TagCloud tags={tags} />
          </div>
        </aside>
      </div>
    </div>
  );
}
