/**
 * GET /api/v1/sites/categories
 *
 * 外部網站分類列表 API
 *
 * 認證：需要 API Key（Authorization: Bearer sk_site_xxx）
 *
 * Response:
 * - categories: 該網站文章使用的所有分類
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  withApiKeyAuth,
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
 * 分類項目
 */
interface CategoryItem {
  name: string;
  count: number;
}

/**
 * 分類列表回應
 */
interface CategoriesResponse {
  categories: CategoryItem[];
  total: number;
}

/**
 * 取得分類列表
 */
async function getCategories(
  _request: NextRequest,
  website: WebsiteInfo,
): Promise<Response> {
  try {
    // 建立快取 key
    const cacheKey = `sites:categories:${website.id}`;

    // 嘗試從快取取得
    const { data: cachedData, fromCache } =
      await cacheGetOrSet<CategoriesResponse>(
        cacheKey,
        CACHE_CONFIG.ARTICLE_LIST.ttl,
        async () => {
          // 查詢該網站所有已發布文章的分類
          const { data: articlesData, error } = await supabase
            .from("generated_articles")
            .select("categories")
            .eq("published_to_website_id", website.id)
            .eq("status", "published")
            .not("categories", "is", null);

          if (error) {
            throw new Error(`Database error: ${error.message}`);
          }

          // 統計每個分類的文章數量
          const categoryCount = new Map<string, number>();

          for (const article of articlesData || []) {
            const categories = article.categories as string[] | null;
            if (categories) {
              for (const category of categories) {
                categoryCount.set(
                  category,
                  (categoryCount.get(category) || 0) + 1,
                );
              }
            }
          }

          // 轉換為陣列並排序（按數量降序）
          const categories: CategoryItem[] = Array.from(categoryCount.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          return {
            categories,
            total: categories.length,
          };
        },
      );

    const response = createSuccessResponse(cachedData);
    response.headers.set("X-Cache", fromCache ? "HIT" : "MISS");

    return response;
  } catch (error) {
    console.error("[Sites API] Error fetching categories:", error);
    return createErrorResponse("Failed to fetch categories", 500);
  }
}

/**
 * GET handler（使用 API Key 認證）
 */
export const GET = withApiKeyAuth(getCategories);
