/**
 * 翻譯任務 API
 *
 * POST: 建立翻譯任務
 * GET: 取得翻譯任務列表
 */

import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { withAuth } from "@/lib/api/auth-middleware";
import {
  successResponse,
  validationError,
  forbidden,
  notFound,
  internalError,
  HTTP_STATUS,
} from "@/lib/api/response-helpers";
import { canAccessTranslation } from "@/lib/translations/access-control";
import {
  cacheSet,
  isRedisAvailable,
  CACHE_CONFIG,
} from "@/lib/cache/redis-cache";
import type {
  TranslationLocale,
  CreateTranslationJobRequest,
  CreateTranslationJobResponse,
} from "@/types/translations";
import { TRANSLATION_LOCALES } from "@/types/translations";

export const maxDuration = 60;

/**
 * POST: 建立翻譯任務
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  // 檢查翻譯功能存取權限（Beta 功能）
  if (!canAccessTranslation(user.email)) {
    return forbidden(
      "Translation feature is currently in beta. Access restricted.",
    );
  }

  // 解析請求
  const body: CreateTranslationJobRequest = await request.json();
  const { article_ids, target_languages } = body;

  // 驗證參數
  if (!article_ids || !Array.isArray(article_ids) || article_ids.length === 0) {
    return validationError(
      "article_ids is required and must be a non-empty array",
    );
  }

  if (
    !target_languages ||
    !Array.isArray(target_languages) ||
    target_languages.length === 0
  ) {
    return validationError(
      "target_languages is required and must be a non-empty array",
    );
  }

  // 驗證語言代碼（使用統一的 TRANSLATION_LOCALES 常數）
  const invalidLocales = target_languages.filter(
    (l) => !TRANSLATION_LOCALES.includes(l as TranslationLocale),
  );
  if (invalidLocales.length > 0) {
    return validationError(`Invalid locales: ${invalidLocales.join(", ")}`);
  }

  try {
    // 使用 service role client（需要繞過 RLS 查詢跨表資料）
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
      return validationError("User is not a member of any company");
    }

    // 驗證文章存在且屬於用戶的公司
    const { data: articles, error: articlesError } = await adminClient
      .from("generated_articles")
      .select("id, title, website_id, company_id")
      .in("id", article_ids)
      .eq("company_id", companyMember.company_id);

    if (articlesError) {
      return internalError("Failed to fetch articles");
    }

    if (!articles || articles.length !== article_ids.length) {
      return notFound("Some articles not found or not accessible");
    }

    // 查詢已有翻譯，避免重複翻譯
    const { data: existingTranslations } = await adminClient
      .from("article_translations")
      .select("source_article_id, target_language")
      .in("source_article_id", article_ids)
      .in("target_language", target_languages);

    // 建立已翻譯的 Set: "articleId:locale"
    const existingSet = new Set(
      existingTranslations?.map(
        (t) => `${t.source_article_id}:${t.target_language}`,
      ) || [],
    );

    // 統計跳過的數量
    let skippedCount = 0;

    // 建立翻譯任務，過濾掉已有翻譯的語言
    const jobs = articles
      .map((article) => {
        // 過濾掉已有翻譯的語言
        const filteredLanguages = target_languages.filter(
          (lang) => !existingSet.has(`${article.id}:${lang}`),
        );

        // 計算跳過的數量
        skippedCount += target_languages.length - filteredLanguages.length;

        // 如果沒有需要翻譯的語言，返回 null
        if (filteredLanguages.length === 0) return null;

        return {
          id: uuidv4(),
          job_id: `trans-${article.id.slice(0, 8)}-${Date.now()}`,
          company_id: companyMember.company_id,
          website_id: article.website_id,
          user_id: user.id,
          source_article_id: article.id,
          target_languages: filteredLanguages,
          status: "pending",
          progress: 0,
          completed_languages: [],
          failed_languages: {},
        };
      })
      .filter(Boolean);

    // 如果所有組合都已翻譯過，返回成功但 job_count 為 0
    if (jobs.length === 0) {
      const response: CreateTranslationJobResponse = {
        success: true,
        job_count: 0,
        jobs: [],
        skipped: {
          count: skippedCount,
          reason: "already_translated",
        },
      };
      return successResponse(response);
    }

    const { error: insertError } = await adminClient
      .from("translation_jobs")
      .insert(jobs);

    if (insertError) {
      console.error("Failed to create translation jobs:", insertError);
      return internalError("Failed to create translation jobs");
    }

    // 設置 Redis flag 通知有待處理翻譯任務
    if (isRedisAvailable()) {
      await cacheSet(
        CACHE_CONFIG.PENDING_TRANSLATION_JOBS.prefix,
        true,
        CACHE_CONFIG.PENDING_TRANSLATION_JOBS.ttl,
      ).catch((err) => {
        // Redis 失敗不影響主流程
        console.warn("[Translation API] Redis flag 設置失敗:", err);
      });
    }

    // 可選：觸發 GitHub Actions 立即處理
    if (process.env.GH_PAT && process.env.GH_REPO) {
      try {
        await fetch(
          `https://api.github.com/repos/${process.env.GH_REPO}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GH_PAT}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "translation-jobs-created",
            }),
          },
        );
        console.log("[Translation API] ✅ GitHub Actions 已觸發");
      } catch (e) {
        // 忽略錯誤，GitHub Actions 會定時處理
        console.warn("[Translation API] GitHub dispatch 失敗:", e);
      }
    }

    const response: CreateTranslationJobResponse = {
      success: true,
      job_count: jobs.length,
      jobs: jobs.map((j) => ({
        job_id: j!.job_id,
        source_article_id: j!.source_article_id,
        target_languages: j!.target_languages as TranslationLocale[],
      })),
      skipped:
        skippedCount > 0
          ? {
              count: skippedCount,
              reason: "already_translated",
            }
          : undefined,
    };

    return successResponse(response, undefined, HTTP_STATUS.CREATED);
  } catch (error: unknown) {
    console.error("Translation API error:", error);
    return internalError((error as Error).message);
  }
});

/**
 * GET: 取得翻譯任務列表
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
  const status = searchParams.get("status");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

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
      return successResponse({ jobs: [], total: 0 });
    }

    // 建立查詢
    let query = adminClient
      .from("translation_jobs")
      .select(
        `
        *,
        generated_articles!source_article_id (
          id,
          title,
          slug
        )
      `,
        { count: "exact" },
      )
      .eq("company_id", companyMember.company_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 篩選狀態
    if (status) {
      query = query.eq("status", status);
    }

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error("Failed to fetch translation jobs:", error);
      return internalError("Failed to fetch translation jobs");
    }

    return successResponse({
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("Translation API error:", error);
    return internalError((error as Error).message);
  }
});
