/**
 * 翻譯任務 API
 *
 * POST: 建立翻譯任務
 * GET: 取得翻譯任務列表
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import {
  canAccessTranslation,
  requireTranslationAccess,
} from "@/lib/translations/access-control";
import type {
  TranslationLocale,
  CreateTranslationJobRequest,
  CreateTranslationJobResponse,
} from "@/types/translations";

export const maxDuration = 60;

/**
 * POST: 建立翻譯任務
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 驗證用戶
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 檢查翻譯功能存取權限
    if (!canAccessTranslation(user.email)) {
      return NextResponse.json(
        {
          error: "Translation feature is currently in beta. Access restricted.",
        },
        { status: 403 },
      );
    }

    // 解析請求
    const body: CreateTranslationJobRequest = await request.json();
    const { article_ids, target_languages } = body;

    // 驗證參數
    if (
      !article_ids ||
      !Array.isArray(article_ids) ||
      article_ids.length === 0
    ) {
      return NextResponse.json(
        { error: "article_ids is required and must be a non-empty array" },
        { status: 400 },
      );
    }

    if (
      !target_languages ||
      !Array.isArray(target_languages) ||
      target_languages.length === 0
    ) {
      return NextResponse.json(
        {
          error: "target_languages is required and must be a non-empty array",
        },
        { status: 400 },
      );
    }

    // 驗證語言代碼
    const validLocales: TranslationLocale[] = [
      "en-US",
      "de-DE",
      "fr-FR",
      "es-ES",
    ];
    const invalidLocales = target_languages.filter(
      (l) => !validLocales.includes(l as TranslationLocale),
    );
    if (invalidLocales.length > 0) {
      return NextResponse.json(
        { error: `Invalid locales: ${invalidLocales.join(", ")}` },
        { status: 400 },
      );
    }

    // 使用 service role client
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
      return NextResponse.json(
        { error: "User is not a member of any company" },
        { status: 400 },
      );
    }

    // 驗證文章存在且屬於用戶的公司
    const { data: articles, error: articlesError } = await adminClient
      .from("generated_articles")
      .select("id, title, website_id, company_id")
      .in("id", article_ids)
      .eq("company_id", companyMember.company_id);

    if (articlesError) {
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 },
      );
    }

    if (!articles || articles.length !== article_ids.length) {
      return NextResponse.json(
        { error: "Some articles not found or not accessible" },
        { status: 404 },
      );
    }

    // 建立翻譯任務
    const jobs = articles.map((article) => ({
      id: uuidv4(),
      job_id: `trans-${article.id.slice(0, 8)}-${Date.now()}`,
      company_id: companyMember.company_id,
      website_id: article.website_id,
      user_id: user.id,
      source_article_id: article.id,
      target_languages: target_languages,
      status: "pending",
      progress: 0,
      completed_languages: [],
      failed_languages: {},
    }));

    const { error: insertError } = await adminClient
      .from("translation_jobs")
      .insert(jobs);

    if (insertError) {
      console.error("Failed to create translation jobs:", insertError);
      return NextResponse.json(
        { error: "Failed to create translation jobs" },
        { status: 500 },
      );
    }

    // 可選：觸發 GitHub Actions 立即處理
    if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPO) {
      try {
        await fetch(
          `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "translation-jobs-created",
            }),
          },
        );
      } catch (e) {
        // 忽略錯誤，GitHub Actions 會定時處理
        console.warn("Failed to trigger GitHub Actions:", e);
      }
    }

    const response: CreateTranslationJobResponse = {
      success: true,
      job_count: jobs.length,
      jobs: jobs.map((j) => ({
        job_id: j.job_id,
        source_article_id: j.source_article_id,
        target_languages: j.target_languages as TranslationLocale[],
      })),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET: 取得翻譯任務列表
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 驗證用戶
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 檢查翻譯功能存取權限
    if (!canAccessTranslation(user.email)) {
      return NextResponse.json(
        {
          error: "Translation feature is currently in beta. Access restricted.",
        },
        { status: 403 },
      );
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    // 使用 service role client
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
      return NextResponse.json({ jobs: [], total: 0 });
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
      return NextResponse.json(
        { error: "Failed to fetch translation jobs" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
