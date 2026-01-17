/**
 * 翻譯文章 API
 *
 * GET: 取得翻譯文章列表（包含各語言翻譯狀態）
 */

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  forbidden,
  handleApiError,
} from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessTranslation } from "@/lib/translations/access-control";
import type {
  ArticleTranslationSummary,
  TranslationLocale,
  TranslationStatus,
} from "@/types/translations";
import { TRANSLATION_LOCALES } from "@/types/translations";

export const maxDuration = 30;

// 翻譯記錄型別
interface TranslationRecord {
  id: string;
  target_language: TranslationLocale;
  status: TranslationStatus;
  published_at: string | null;
}

/**
 * GET: 取得文章的翻譯狀態摘要
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  if (!canAccessTranslation(user.email)) {
    return forbidden(
      "Translation feature is currently in beta. Access restricted.",
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");
  const search = searchParams.get("search");
  const websiteId = searchParams.get("website_id");
  const filter = searchParams.get("filter") || "all"; // all | translated | not_translated

  try {
    const adminClient = createAdminClient();

    // 取得用戶的公司
    const { data: companyMember, error: memberError } = await adminClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (memberError || !companyMember) {
      console.warn("[Translation Articles] No company found:", user.id);
      return successResponse({ articles: [], total: 0 });
    }

    // 查詢已發布文章
    let articlesQuery = adminClient
      .from("generated_articles")
      .select("id, title, slug, status, created_at", { count: "exact" })
      .eq("company_id", companyMember.company_id)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    // 套用翻譯狀態篩選
    if (filter === "translated" || filter === "not_translated") {
      const { data: translatedArticles } = await adminClient
        .from("article_translations")
        .select("source_article_id")
        .eq("company_id", companyMember.company_id);

      const translatedIds = [...new Set(
        (translatedArticles || []).map((t) => t.source_article_id)
      )];

      if (filter === "translated") {
        if (translatedIds.length === 0) {
          return successResponse({ articles: [], total: 0, limit, offset, filter });
        }
        articlesQuery = articlesQuery.in("id", translatedIds);
      } else if (translatedIds.length > 0) {
        articlesQuery = articlesQuery.not("id", "in", `(${translatedIds.join(",")})`);
      }
    }

    if (search) articlesQuery = articlesQuery.ilike("title", `%${search}%`);
    if (websiteId) articlesQuery = articlesQuery.eq("published_to_website_id", websiteId);

    // 套用分頁
    articlesQuery = articlesQuery.range(offset, offset + limit - 1);

    const { data: articles, error, count } = await articlesQuery;

    if (error) {
      console.error("[Translation Articles] Query failed:", error.message);
      return handleApiError(new Error("Failed to fetch articles"));
    }

    // 批量查詢翻譯狀態
    const articleIds = (articles || []).map((a) => a.id);
    const translationsMap = new Map<string, TranslationRecord[]>();

    if (articleIds.length > 0) {
      const { data: translations } = await adminClient
        .from("article_translations")
        .select("id, source_article_id, target_language, status, published_at")
        .in("source_article_id", articleIds);

      // 按 source_article_id 分組
      for (const t of translations || []) {
        const existing = translationsMap.get(t.source_article_id) || [];
        existing.push({
          id: t.id,
          target_language: t.target_language as TranslationLocale,
          status: t.status as TranslationStatus,
          published_at: t.published_at,
        });
        translationsMap.set(t.source_article_id, existing);
      }
    }

    // 組裝結果
    const summaries: ArticleTranslationSummary[] = (articles || []).map((article) => {
      const translations = translationsMap.get(article.id) || [];
      const langMap = new Map(translations.map((t) => [t.target_language, t]));

      return {
        article_id: article.id,
        article_title: article.title,
        translations: TRANSLATION_LOCALES.map((locale) => {
          const translation = langMap.get(locale);
          return {
            locale,
            status: translation?.status ?? "not_translated",
            translation_id: translation?.id ?? null,
            published_at: translation?.published_at ?? null,
          };
        }),
      };
    });

    return successResponse({
      articles: summaries,
      total: count || 0,
      limit,
      offset,
      filter,
    });
  } catch (error) {
    console.error("[Translation Articles] Error:", error);
    return handleApiError(error);
  }
});
