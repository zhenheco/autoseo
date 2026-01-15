/**
 * GET /api/v1/sites/languages
 *
 * 外部網站語系列表 API
 *
 * 認證：需要 API Key（Authorization: Bearer sk_site_xxx）
 *
 * Response:
 * - languages: 該網站已有翻譯的所有語系
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
 * 語系名稱對照
 */
const LANGUAGE_NAMES: Record<string, string> = {
  "zh-TW": "繁體中文",
  "zh-CN": "简体中文",
  "en-US": "English",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "es-ES": "Español",
  "fr-FR": "Français",
  "de-DE": "Deutsch",
  "pt-BR": "Português",
  "vi-VN": "Tiếng Việt",
  "th-TH": "ไทย",
  "id-ID": "Bahasa Indonesia",
};

/**
 * 語系項目
 */
interface LanguageItem {
  code: string;
  name: string;
  articleCount: number;
  isDefault: boolean;
}

/**
 * 語系列表回應
 */
interface LanguagesResponse {
  languages: LanguageItem[];
  defaultLanguage: string;
}

/**
 * 取得語系列表
 */
async function getLanguages(
  _request: NextRequest,
  website: WebsiteInfo,
): Promise<Response> {
  try {
    // 建立快取 key
    const cacheKey = `sites:languages:${website.id}`;

    // 嘗試從快取取得
    const { data: cachedData, fromCache } =
      await cacheGetOrSet<LanguagesResponse>(
        cacheKey,
        CACHE_CONFIG.ARTICLE_LIST.ttl,
        async () => {
          // 查詢該網站已發布文章數量（原文）
          const { count: originalCount, error: originalError } = await supabase
            .from("generated_articles")
            .select("id", { count: "exact", head: true })
            .eq("published_to_website_id", website.id)
            .eq("status", "published");

          if (originalError) {
            throw new Error(`Database error: ${originalError.message}`);
          }

          // 查詢該網站所有已發布文章的 ID
          const { data: articlesData, error: articlesError } = await supabase
            .from("generated_articles")
            .select("id")
            .eq("published_to_website_id", website.id)
            .eq("status", "published");

          if (articlesError) {
            throw new Error(`Database error: ${articlesError.message}`);
          }

          const articleIds = (articlesData || []).map((a) => a.id);

          // 查詢翻譯版本的語系統計
          const languageCount = new Map<string, number>();

          if (articleIds.length > 0) {
            const { data: translationsData, error: translationsError } =
              await supabase
                .from("article_translations")
                .select("language")
                .in("article_id", articleIds)
                .eq("status", "published");

            if (translationsError) {
              throw new Error(`Database error: ${translationsError.message}`);
            }

            for (const translation of translationsData || []) {
              languageCount.set(
                translation.language,
                (languageCount.get(translation.language) || 0) + 1,
              );
            }
          }

          // 建立語系列表（原文 + 翻譯）
          const languages: LanguageItem[] = [
            {
              code: "zh-TW",
              name: LANGUAGE_NAMES["zh-TW"] || "繁體中文",
              articleCount: originalCount || 0,
              isDefault: true,
            },
            ...Array.from(languageCount.entries()).map(([code, count]) => ({
              code,
              name: LANGUAGE_NAMES[code] || code,
              articleCount: count,
              isDefault: false,
            })),
          ];

          // 按文章數量排序（原文永遠在第一位）
          languages.sort((a, b) => {
            if (a.isDefault) return -1;
            if (b.isDefault) return 1;
            return b.articleCount - a.articleCount;
          });

          return {
            languages,
            defaultLanguage: "zh-TW",
          };
        },
      );

    const response = createSuccessResponse(cachedData);
    response.headers.set("X-Cache", fromCache ? "HIT" : "MISS");

    return response;
  } catch (error) {
    console.error("[Sites API] Error fetching languages:", error);
    return createErrorResponse("Failed to fetch languages", 500);
  }
}

/**
 * GET handler（使用 API Key 認證）
 */
export const GET = withApiKeyAuth(getLanguages);
