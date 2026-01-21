/**
 * GET /api/v1/sites/articles/:slug
 *
 * 外部網站單篇文章 API
 *
 * 認證：需要 API Key（Authorization: Bearer sk_site_xxx）
 *
 * Query params:
 * - lang: 語系（如 zh-TW, en-US），預設返回原文
 *
 * Response:
 * - article: 文章內容
 * - translations: 所有已翻譯版本的摘要資訊
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  withApiKeyAuth,
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
 * 文章詳情
 */
interface ArticleDetail {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  html_content: string | null;
  markdown_content: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  categories: string[];
  tags: string[];
  reading_time: number | null;
  word_count: number | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
  language: string;
}

/**
 * 翻譯版本摘要
 */
interface TranslationSummary {
  language: string;
  title: string;
  slug: string;
  excerpt: string | null;
}

/**
 * 單篇文章回應
 */
interface ArticleResponse {
  article: ArticleDetail;
  translations: Record<string, TranslationSummary>;
}

/**
 * 取得單篇文章
 */
async function getArticle(
  request: NextRequest,
  website: WebsiteInfo,
  params: { slug: string },
): Promise<Response> {
  try {
    const lang = getLanguageParam(request);
    const { slug } = params;

    if (!slug) {
      return createErrorResponse("Missing slug parameter", 400);
    }

    // 診斷日誌
    console.log(
      `[Sites API] getArticle - website_id: ${website.id}, slug: ${slug}, lang: ${lang || "default"}`,
    );

    // 建立快取 key
    const cacheKey = `sites:article:${website.id}:${slug}:${lang || "all"}`;

    // 嘗試從快取取得
    const { data: cachedData, fromCache } =
      await cacheGetOrSet<ArticleResponse | null>(
        cacheKey,
        CACHE_CONFIG.ARTICLE_HTML.ttl,
        async () => {
          // 查詢原文文章（使用 maybeSingle 避免找不到時拋錯）
          const { data: articleData, error: articleError } = await supabase
            .from("generated_articles")
            .select(
              `
              id,
              slug,
              title,
              excerpt,
              html_content,
              markdown_content,
              featured_image_url,
              featured_image_alt,
              categories,
              tags,
              reading_time,
              word_count,
              meta_title,
              meta_description,
              published_at
            `,
            )
            .eq("published_to_website_id", website.id)
            .eq("status", "published")
            .eq("slug", slug)
            .maybeSingle();

          // 區分「真正的錯誤」和「找不到資料」
          if (articleError) {
            console.error(`[Sites API] Database query error:`, {
              website_id: website.id,
              slug,
              error: articleError.message,
              code: articleError.code,
            });
            return null;
          }

          if (!articleData) {
            console.log(
              `[Sites API] Article not found by slug, trying translation fallback - slug: ${slug}`,
            );

            // 嘗試用翻譯版本的 slug 查詢（加上 website 過濾避免跨網站匹配）
            const { data: translationBySlug, error: translationError } =
              await supabase
                .from("article_translations")
                .select(
                  `
                article_id,
                language,
                generated_articles!inner(published_to_website_id)
              `,
                )
                .eq("slug", slug)
                .eq("status", "published")
                .eq("generated_articles.published_to_website_id", website.id)
                .maybeSingle();

            if (translationError) {
              console.error(`[Sites API] Translation query error:`, {
                slug,
                error: translationError.message,
                code: translationError.code,
              });
              return null;
            }

            if (translationBySlug) {
              console.log(
                `[Sites API] Found translation - article_id: ${translationBySlug.article_id}, language: ${translationBySlug.language}`,
              );

              // 找到翻譯版本，查詢原文
              const { data: originalArticle, error: originalError } =
                await supabase
                  .from("generated_articles")
                  .select(
                    `
                  id,
                  slug,
                  title,
                  excerpt,
                  html_content,
                  markdown_content,
                  featured_image_url,
                  featured_image_alt,
                  categories,
                  tags,
                  reading_time,
                  word_count,
                  meta_title,
                  meta_description,
                  published_at
                `,
                  )
                  .eq("id", translationBySlug.article_id)
                  .eq("published_to_website_id", website.id)
                  .eq("status", "published")
                  .maybeSingle();

              if (originalError) {
                console.error(`[Sites API] Original article query error:`, {
                  article_id: translationBySlug.article_id,
                  error: originalError.message,
                  code: originalError.code,
                });
                return null;
              }

              if (!originalArticle) {
                console.log(
                  `[Sites API] Original article not found for translation - article_id: ${translationBySlug.article_id}`,
                );
                return null;
              }

              // 繼續用翻譯版本的語系
              return buildArticleResponse(
                originalArticle,
                translationBySlug.language,
              );
            }

            console.log(
              `[Sites API] No article or translation found - website_id: ${website.id}, slug: ${slug}`,
            );
            return null;
          }

          console.log(
            `[Sites API] Article found - id: ${articleData.id}, title: ${articleData.title}`,
          );
          return buildArticleResponse(articleData, lang || "zh-TW");
        },
      );

    if (!cachedData) {
      return createErrorResponse("Article not found", 404);
    }

    const response = createSuccessResponse(cachedData);
    response.headers.set("X-Cache", fromCache ? "HIT" : "MISS");

    return response;
  } catch (error) {
    console.error("[Sites API] Error fetching article:", error);
    return createErrorResponse("Failed to fetch article", 500);
  }
}

/**
 * 原文文章資料型別
 */
type OriginalArticleData = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  html_content: string | null;
  markdown_content: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  categories: string[] | null;
  tags: string[] | null;
  reading_time: number | null;
  word_count: number | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
};

/**
 * 將原文資料轉換為 ArticleDetail
 */
function toArticleDetail(
  data: OriginalArticleData,
  language: string,
): ArticleDetail {
  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    excerpt: data.excerpt,
    html_content: data.html_content,
    markdown_content: data.markdown_content,
    featured_image_url: data.featured_image_url,
    featured_image_alt: data.featured_image_alt,
    categories: data.categories || [],
    tags: data.tags || [],
    reading_time: data.reading_time,
    word_count: data.word_count,
    meta_title: data.meta_title,
    meta_description: data.meta_description,
    published_at: data.published_at,
    language,
  };
}

/**
 * 建立文章回應（包含翻譯版本）
 */
async function buildArticleResponse(
  articleData: OriginalArticleData,
  targetLang: string,
): Promise<ArticleResponse> {
  // 查詢所有翻譯版本
  const { data: translationsData } = await supabase
    .from("article_translations")
    .select(
      `
      language,
      title,
      slug,
      excerpt,
      html_content,
      markdown_content,
      reading_time,
      word_count,
      meta_title,
      meta_description
    `,
    )
    .eq("article_id", articleData.id)
    .eq("status", "published");

  // 建立翻譯摘要 map（原文 + 所有翻譯版本）
  const translations: Record<string, TranslationSummary> = {
    "zh-TW": {
      language: "zh-TW",
      title: articleData.title,
      slug: articleData.slug,
      excerpt: articleData.excerpt,
    },
  };

  for (const t of translationsData || []) {
    translations[t.language] = {
      language: t.language,
      title: t.title,
      slug: t.slug,
      excerpt: t.excerpt,
    };
  }

  // 決定要返回的文章內容
  // 如果目標語系是原文或找不到翻譯，返回原文
  if (targetLang === "zh-TW") {
    return { article: toArticleDetail(articleData, "zh-TW"), translations };
  }

  const translation = (translationsData || []).find(
    (t) => t.language === targetLang,
  );

  if (!translation) {
    // 沒有該語系的翻譯，返回原文
    return { article: toArticleDetail(articleData, "zh-TW"), translations };
  }

  // 合併翻譯內容（翻譯欄位優先，缺少的用原文補齊）
  const article: ArticleDetail = {
    id: articleData.id,
    slug: translation.slug || articleData.slug,
    title: translation.title || articleData.title,
    excerpt: translation.excerpt || articleData.excerpt,
    html_content: translation.html_content || articleData.html_content,
    markdown_content:
      translation.markdown_content || articleData.markdown_content,
    featured_image_url: articleData.featured_image_url,
    featured_image_alt: articleData.featured_image_alt,
    categories: articleData.categories || [],
    tags: articleData.tags || [],
    reading_time: translation.reading_time || articleData.reading_time,
    word_count: translation.word_count || articleData.word_count,
    meta_title: translation.meta_title || articleData.meta_title,
    meta_description:
      translation.meta_description || articleData.meta_description,
    published_at: articleData.published_at,
    language: targetLang,
  };

  return { article, translations };
}

/**
 * GET handler（使用 API Key 認證）
 *
 * Next.js App Router 動態路由處理
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  // 使用 withApiKeyAuth 包裝，但需要處理 params
  const authHandler = withApiKeyAuth(async (req, website) => {
    const params = await context.params;
    return getArticle(req, website, params);
  });

  return authHandler(request);
}
