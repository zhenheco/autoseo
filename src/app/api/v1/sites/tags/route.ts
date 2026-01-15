/**
 * GET /api/v1/sites/tags
 *
 * 外部網站標籤列表 API
 *
 * 認證：需要 API Key（Authorization: Bearer sk_site_xxx）
 *
 * Response:
 * - tags: 該網站文章使用的所有標籤
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
 * 標籤項目
 */
interface TagItem {
  name: string;
  count: number;
}

/**
 * 標籤列表回應
 */
interface TagsResponse {
  tags: TagItem[];
  total: number;
}

/**
 * 取得標籤列表
 */
async function getTags(
  _request: NextRequest,
  website: WebsiteInfo,
): Promise<Response> {
  try {
    // 建立快取 key
    const cacheKey = `sites:tags:${website.id}`;

    // 嘗試從快取取得
    const { data: cachedData, fromCache } = await cacheGetOrSet<TagsResponse>(
      cacheKey,
      CACHE_CONFIG.ARTICLE_LIST.ttl,
      async () => {
        // 查詢該網站所有已發布文章的標籤
        const { data: articlesData, error } = await supabase
          .from("generated_articles")
          .select("tags")
          .eq("published_to_website_id", website.id)
          .eq("status", "published")
          .not("tags", "is", null);

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }

        // 統計每個標籤的文章數量
        const tagCount = new Map<string, number>();

        for (const article of articlesData || []) {
          const tags = article.tags as string[] | null;
          if (tags) {
            for (const tag of tags) {
              tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
            }
          }
        }

        // 轉換為陣列並排序（按數量降序）
        const tags: TagItem[] = Array.from(tagCount.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        return {
          tags,
          total: tags.length,
        };
      },
    );

    const response = createSuccessResponse(cachedData);
    response.headers.set("X-Cache", fromCache ? "HIT" : "MISS");

    return response;
  } catch (error) {
    console.error("[Sites API] Error fetching tags:", error);
    return createErrorResponse("Failed to fetch tags", 500);
  }
}

/**
 * GET handler（使用 API Key 認證）
 */
export const GET = withApiKeyAuth(getTags);
