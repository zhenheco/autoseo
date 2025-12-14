import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { SupportedLocale } from "@/types/translations";

// 使用 service role 取得資料
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 取得公開 Blog 文章（包含翻譯版本）
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

  // 取得所有已發布文章（包含翻譯資訊）
  const { data } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      slug,
      updated_at,
      categories,
      tags,
      article_translations (
        target_language,
        slug,
        updated_at
      )
    `,
    )
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
 * 建立多語系 hreflang 對照表
 */
function buildLanguageAlternates(
  baseUrl: string,
  originalSlug: string,
  translations: Array<{ target_language: string; slug: string }>,
): Record<string, string> {
  const languages: Record<string, string> = {
    "zh-TW": `${baseUrl}/blog/zh-TW/${originalSlug}`,
    "x-default": `${baseUrl}/blog/zh-TW/${originalSlug}`,
  };

  for (const t of translations || []) {
    languages[t.target_language] =
      `${baseUrl}/blog/${t.target_language}/${t.slug}`;
  }

  return languages;
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

  // Blog 文章頁面（中文原文 + 翻譯版本）
  const blogArticles: MetadataRoute.Sitemap = [];

  for (const article of articles) {
    const translations = (article.article_translations || []) as Array<{
      target_language: string;
      slug: string;
      updated_at: string;
    }>;

    // 建立 hreflang 對照表
    const alternates = buildLanguageAlternates(
      baseUrl,
      article.slug,
      translations,
    );

    // 中文原文
    blogArticles.push({
      url: `${baseUrl}/blog/zh-TW/${article.slug}`,
      lastModified: new Date(article.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      alternates: {
        languages: alternates,
      },
    });

    // 翻譯版本
    for (const translation of translations) {
      blogArticles.push({
        url: `${baseUrl}/blog/${translation.target_language}/${translation.slug}`,
        lastModified: new Date(translation.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
        alternates: {
          languages: alternates,
        },
      });
    }
  }

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
