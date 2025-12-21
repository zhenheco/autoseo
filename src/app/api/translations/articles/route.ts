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
  internalError,
} from "@/lib/api/response-helpers";
import { canAccessTranslation } from "@/lib/translations/access-control";
import type { ArticleTranslationSummary } from "@/types/translations";
import { TRANSLATION_LOCALES } from "@/types/translations";

export const maxDuration = 30;

/**
 * GET: 取得文章的翻譯狀態摘要
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  // 檢查翻譯功能存取權限（Beta 功能）
  if (!canAccessTranslation(user.email)) {
    return forbidden(
      "Translation feature is currently in beta. Access restricted.",
    );
  }

  // 解析查詢參數
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");
  const search = searchParams.get("search");
  const websiteId = searchParams.get("website_id");

  try {
    // 使用 service role client（需要繞過 RLS）
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 取得用戶的公司
    const { data: companyMember } = await adminClient
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyMember) {
      return successResponse({ articles: [], total: 0 });
    }

    // 查詢原始文章
    let articlesQuery = adminClient
      .from("generated_articles")
      .select(
        `
        id,
        title,
        slug,
        status,
        created_at,
        article_translations (
          id,
          target_language,
          status,
          published_at
        )
      `,
        { count: "exact" },
      )
      .eq("company_id", companyMember.company_id)
      .eq("status", "published") // 只顯示已發布的文章
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 搜尋
    if (search) {
      articlesQuery = articlesQuery.ilike("title", `%${search}%`);
    }

    // 按網站過濾
    if (websiteId) {
      articlesQuery = articlesQuery.eq("published_to_website_id", websiteId);
    }

    const { data: articles, error, count } = await articlesQuery;

    if (error) {
      console.error("Failed to fetch articles:", error);
      return internalError("Failed to fetch articles");
    }

    // 組裝結果
    const summaries: ArticleTranslationSummary[] = (articles || []).map(
      (article) => {
        const translationsMap = new Map(
          (article.article_translations || []).map((t: any) => [
            t.target_language,
            t,
          ]),
        );

        return {
          article_id: article.id,
          article_title: article.title,
          translations: TRANSLATION_LOCALES.map((locale) => {
            const translation = translationsMap.get(locale);
            return {
              locale,
              status: translation
                ? (translation.status as any)
                : "not_translated",
              translation_id: translation?.id || null,
              published_at: translation?.published_at || null,
            };
          }),
        };
      },
    );

    return successResponse({
      articles: summaries,
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("Translation articles API error:", error);
    return internalError((error as Error).message);
  }
});
