/**
 * GET /api/v1/sites/articles
 *
 * 外部網站文章列表 API
 *
 * 認證：需要 API Key（Authorization: Bearer sk_site_xxx）
 *
 * Query params:
 * - page: 頁碼（預設 1）
 * - limit: 每頁數量（預設 10，最大 100）
 * - lang: 語系篩選（如 zh-TW, en-US）
 * - category: 篩選分類
 * - tag: 篩選標籤
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  withApiKeyAuth,
  getPaginationParams,
  getLanguageParam,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/api-key/auth-middleware";
import { WebsiteInfo } from "@/lib/api-key/api-key-service";
import { cacheGetOrSet, CACHE_CONFIG } from "@/lib/cache/redis-cache";

// 使用 service role key 繞過 RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * 文章列表項目
 */
interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image_url: string | null;
  categories: string[];
  tags: string[];
  reading_time: number | null;
  published_at: string | null;
  language: string;
}

/**
 * 文章列表回應
 */
interface ArticlesResponse {
  articles: ArticleListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  available_languages: string[];
}

/**
 * 取得文章列表
 */
async function getArticles(
  request: NextRequest,
  website: WebsiteInfo,
): Promise<Response> {
  try {
    const { page, limit } = getPaginationParams(request);
    const lang = getLanguageParam(request);
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const tag = url.searchParams.get("tag");

    // 建立快取 key
    const cacheKey = `sites:articles:${website.id}:${page}:${limit}:${lang || "all"}:${category || ""}:${tag || ""}`;

    // 嘗試從快取取得
    const { data: cachedData, fromCache } =
      await cacheGetOrSet<ArticlesResponse>(
        cacheKey,
        CACHE_CONFIG.ARTICLE_LIST.ttl,
        async () => {
          // 查詢原文文章
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
            published_at
          `,
              { count: "exact" },
            )
            .eq("published_to_website_id", website.id)
            .eq("status", "published")
            .not("slug", "is", null);

          // 分類篩選
          if (category) {
            query = query.contains("categories", [category]);
          }

          // 標籤篩選
          if (tag) {
            query = query.contains("tags", [tag]);
          }

          // 排序和分頁
          query = query
            .order("published_at", { ascending: false })
            .range((page - 1) * limit, page * limit - 1);

          const { data: articlesData, count, error } = await query;

          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }

          // 如果有語系篩選且不是原文語系，查詢翻譯版本
          let articles: ArticleListItem[] = [];

          if (lang && lang !== "zh-TW") {
            // 查詢翻譯版本
            const articleIds = (articlesData || []).map((a) => a.id);

            if (articleIds.length > 0) {
              const { data: translationsData } = await supabase
                .from("article_translations")
                .select(
                  `
                article_id,
                language,
                title,
                excerpt,
                slug,
                reading_time
              `,
                )
                .in("article_id", articleIds)
                .eq("language", lang)
                .eq("status", "published");

              // 建立翻譯 map
              const translationMap = new Map(
                (translationsData || []).map((t) => [t.article_id, t]),
              );

              // 合併原文和翻譯
              articles = (articlesData || [])
                .map((article) => {
                  const translation = translationMap.get(article.id);
                  if (translation) {
                    return {
                      id: article.id,
                      slug: translation.slug || article.slug,
                      title: translation.title || article.title,
                      excerpt: translation.excerpt || article.excerpt,
                      featured_image_url: article.featured_image_url,
                      categories: article.categories || [],
                      tags: article.tags || [],
                      reading_time:
                        translation.reading_time || article.reading_time,
                      published_at: article.published_at,
                      language: lang,
                    };
                  }
                  return null;
                })
                .filter((a): a is ArticleListItem => a !== null);
            }
          } else {
            // 原文版本
            articles = (articlesData || []).map((article) => ({
              id: article.id,
              slug: article.slug,
              title: article.title,
              excerpt: article.excerpt,
              featured_image_url: article.featured_image_url,
              categories: article.categories || [],
              tags: article.tags || [],
              reading_time: article.reading_time,
              published_at: article.published_at,
              language: "zh-TW",
            }));
          }

          // 查詢該網站所有已有翻譯的語系
          const { data: languagesData } = await supabase
            .from("article_translations")
            .select("language")
            .in(
              "article_id",
              (articlesData || []).map((a) => a.id),
            )
            .eq("status", "published");

          const availableLanguages = [
            "zh-TW",
            ...new Set((languagesData || []).map((l) => l.language)),
          ];

          const totalCount = count || 0;
          const totalPages = Math.ceil(totalCount / limit);

          return {
            articles,
            pagination: {
              page,
              limit,
              total: totalCount,
              totalPages,
              hasMore: page < totalPages,
            },
            available_languages: availableLanguages,
          };
        },
      );

    // 加入快取狀態 header
    const response = createSuccessResponse(cachedData);
    response.headers.set("X-Cache", fromCache ? "HIT" : "MISS");

    return response;
  } catch (error) {
    console.error("[Sites API] Error fetching articles:", error);
    return createErrorResponse("Failed to fetch articles", 500);
  }
}

/**
 * GET handler（使用 API Key 認證）
 */
export const GET = withApiKeyAuth(getArticles);
