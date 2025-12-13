import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 取得公開 Blog 文章
 */
async function getBlogArticles() {
  // 先取得平台 Blog 站點 ID
  const { data: platformBlog } = await supabase
    .from("website_configs")
    .select("id")
    .eq("is_platform_blog", true)
    .single();

  if (!platformBlog) {
    return {
      articles: [],
      categories: new Set<string>(),
      tags: new Set<string>(),
    };
  }

  // 取得所有已發布文章
  const { data } = await supabase
    .from("generated_articles")
    .select("slug, updated_at, categories, tags")
    .eq("published_to_website_id", platformBlog.id)
    .eq("status", "published")
    .not("slug", "is", null);

  const articles = data || [];
  const categories = new Set<string>();
  const tags = new Set<string>();

  for (const article of articles) {
    for (const cat of article.categories || []) {
      if (cat) categories.add(cat);
    }
    for (const tag of article.tags || []) {
      if (tag) tags.add(tag);
    }
  }

  return { articles, categories, tags };
}

/**
 * 生成 sitemap.xml 配置
 * 幫助搜尋引擎發現網站頁面
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://1wayseo.com";

  // 靜態頁面
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  // 取得 Blog 資料
  const { articles, categories, tags } = await getBlogArticles();

  // Blog 首頁
  const blogIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  // Blog 文章頁面
  const blogArticles: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${baseUrl}/blog/${article.slug}`,
    lastModified: new Date(article.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // 分類頁面
  const categoryPages: MetadataRoute.Sitemap = Array.from(categories).map(
    (category) => ({
      url: `${baseUrl}/blog/category/${encodeURIComponent(category)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }),
  );

  // 標籤頁面
  const tagPages: MetadataRoute.Sitemap = Array.from(tags).map((tag) => ({
    url: `${baseUrl}/blog/tag/${encodeURIComponent(tag)}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...blogIndex,
    ...blogArticles,
    ...categoryPages,
    ...tagPages,
  ];
}
