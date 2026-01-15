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

    // 建立快取 key
    const cacheKey = `sites:article:${website.id}:${slug}:${lang || "all"}`;

    // 嘗試從快取取得
    const { data: cachedData, fromCache } =
      await cacheGetOrSet<ArticleResponse | null>(
        cacheKey,
        CACHE_CONFIG.ARTICLE_HTML.ttl,
        async () => {
          // 查詢原文文章
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
            .single();

          if (articleError || !articleData) {
            // 嘗試用翻譯版本的 slug 查詢
            const { data: translationBySlug } = await supabase
              .from("article_translations")
              .select("article_id, language")
              .eq("slug", slug)
              .eq("status", "published")
              .single();

            if (translationBySlug) {
              // 找到翻譯版本，查詢原文
              const { data: originalArticle } = await supabase
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
                .single();

              if (!originalArticle) {
                return null;
              }

              // 繼續用翻譯版本的語系
              return buildArticleResponse(
                originalArticle,
                translationBySlug.language,
              );
            }

            return null;
          }

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
 * 建立文章回應（包含翻譯版本）
 */
async function buildArticleResponse(
  articleData: {
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
  },
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

  // 建立翻譯 map
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
  let article: ArticleDetail;

  if (targetLang === "zh-TW") {
    // 返回原文
    article = {
      id: articleData.id,
      slug: articleData.slug,
      title: articleData.title,
      excerpt: articleData.excerpt,
      html_content: articleData.html_content,
      markdown_content: articleData.markdown_content,
      featured_image_url: articleData.featured_image_url,
      featured_image_alt: articleData.featured_image_alt,
      categories: articleData.categories || [],
      tags: articleData.tags || [],
      reading_time: articleData.reading_time,
      word_count: articleData.word_count,
      meta_title: articleData.meta_title,
      meta_description: articleData.meta_description,
      published_at: articleData.published_at,
      language: "zh-TW",
    };
  } else {
    // 尋找翻譯版本
    const translation = (translationsData || []).find(
      (t) => t.language === targetLang,
    );

    if (translation) {
      article = {
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
    } else {
      // 沒有該語系的翻譯，返回原文
      article = {
        id: articleData.id,
        slug: articleData.slug,
        title: articleData.title,
        excerpt: articleData.excerpt,
        html_content: articleData.html_content,
        markdown_content: articleData.markdown_content,
        featured_image_url: articleData.featured_image_url,
        featured_image_alt: articleData.featured_image_alt,
        categories: articleData.categories || [],
        tags: articleData.tags || [],
        reading_time: articleData.reading_time,
        word_count: articleData.word_count,
        meta_title: articleData.meta_title,
        meta_description: articleData.meta_description,
        published_at: articleData.published_at,
        language: "zh-TW",
      };
    }
  }

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
