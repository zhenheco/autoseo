import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";
import { createSearchRouter } from "@/lib/search/search-router";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";
import {
  cacheSet,
  isRedisAvailable,
  CACHE_CONFIG,
} from "@/lib/cache/redis-cache";

export const maxDuration = 300;

/**
 * 觸發 GitHub Actions workflow 立即處理任務（非阻塞）
 * 失敗時不影響主流程，輪詢機制會作為備援
 */
async function triggerGitHubWorkflow(jobId: string): Promise<void> {
  const githubToken = process.env.GH_PAT; // Personal Access Token with repo scope
  const githubRepo = process.env.GH_REPO; // 格式：owner/repo

  if (!githubToken || !githubRepo) {
    console.log(
      "[Generate API] GH_PAT 或 GH_REPO 未設置，跳過立即觸發（輪詢會處理）",
    );
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "article-jobs-created",
          client_payload: { job_id: jobId },
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `[Generate API] GitHub dispatch 失敗: ${response.status}（輪詢會處理）`,
      );
    } else {
      console.log(`[Generate API] ✅ GitHub Actions 已觸發，任務將立即處理`);
    }
  } catch (error) {
    console.warn("[Generate API] GitHub dispatch 錯誤:", error);
    // 失敗不影響主流程，輪詢會處理
  }
}

export async function POST(request: NextRequest) {
  try {
    // 支持新舊兩種參數格式：
    // 舊版：{ keyword, title, mode }
    // 新版：{ industry, region, language, competitors }
    const body = await request.json();
    const {
      keyword,
      title,
      mode,
      industry,
      region,
      language,
      competitors,
      website_id,
      writing_style,
    } = body;

    // 向後兼容：支持舊版 keyword/title 和新版 industry 參數
    const articleTitle = title || keyword;

    // 新版驗證
    if (industry || region || language) {
      if (!industry || typeof industry !== "string") {
        return NextResponse.json(
          { error: "Industry is required" },
          { status: 400 },
        );
      }
      if (!region || typeof region !== "string") {
        return NextResponse.json(
          { error: "Region is required" },
          { status: 400 },
        );
      }
      if (!language || typeof language !== "string") {
        return NextResponse.json(
          { error: "Language is required" },
          { status: 400 },
        );
      }
    } else if (!articleTitle || typeof articleTitle !== "string") {
      // 舊版驗證
      return NextResponse.json(
        { error: "Title or industry is required" },
        { status: 400 },
      );
    }

    // 支持兩種認證方式：
    // 1. Authorization header（用於 API/curl 請求）
    // 2. Cookies（用於瀏覽器請求）
    const authHeader = request.headers.get("authorization");
    let user = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { createClient: createSupabaseClient } = await import(
        "@supabase/supabase-js"
      );
      const authClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      // 使用 JWT token 獲取用戶信息
      const { data: userData, error: userError } =
        await authClient.auth.getUser(token);

      if (userError || !userData.user) {
        return NextResponse.json(
          { error: "Invalid token", details: userError?.message },
          { status: 401 },
        );
      }

      user = userData.user;
    } else {
      const cookieClient = await createClient();
      const {
        data: { user: cookieUser },
      } = await cookieClient.auth.getUser();
      user = cookieUser;
    }

    // 使用 service role client 進行資料庫查詢（避免 RLS 問題）
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting 檢查
    const rateLimitResponse = await checkRateLimit(
      `generate:${user.id}`,
      RATE_LIMIT_CONFIGS.ARTICLE_GENERATE,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 嘗試獲取 company_id（如果用戶有加入公司），否則使用 user_id
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    // 使用 company_id 或 user_id 作為 billing identifier
    const billingId = membership?.company_id || user.id;

    // 檢查 subscription 是否存在（防止無訂閱用戶生成文章）
    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select("id, status")
      .eq("company_id", billingId)
      .eq("status", "active")
      .single();

    if (!subscription) {
      return NextResponse.json(
        { error: "找不到有效的訂閱，請聯絡客服信箱處理" },
        { status: 402 },
      );
    }

    const quotaService = new ArticleQuotaService(supabase);
    const articleJobId = uuidv4();

    // 處理 website_id：
    // - 如果 body 中包含 website_id 欄位（即使是 null），則使用該值
    // - 如果 body 中沒有 website_id 欄位，則自動查詢第一個可用網站
    const hasWebsiteIdField = "website_id" in body;
    let websiteId: string | null = website_id || null;

    if (!hasWebsiteIdField && !websiteId) {
      const websiteQuery = await supabase
        .from("website_configs")
        .select("id")
        .eq("company_id", billingId)
        .limit(1);

      const websites = websiteQuery.data;

      if (websites && websites.length > 0) {
        websiteId = websites[0].id;
        console.log("自動使用現有網站配置:", websiteId);
      } else {
        console.log("無網站配置 - 文章將稍後決定發佈目標");
      }
    } else if (websiteId) {
      console.log("使用指定網站:", websiteId);
    } else {
      console.log("用戶選擇不指定網站");
    }

    // 構建 job metadata
    const jobMetadata = {
      mode: mode || "single",
      title: articleTitle,
      industry: industry || null,
      region: region || null,
      language: language || null,
      competitors: competitors || [],
      competitorAnalysis: null as unknown,
      writing_style: writing_style || null,
    };

    // 先創建 article_job（因為 token_reservations 有 FK 約束引用 article_jobs）
    const { error: jobError } = await supabase.from("article_jobs").insert({
      id: articleJobId,
      job_id: articleJobId,
      company_id: billingId,
      website_id: websiteId,
      user_id: user.id,
      keywords: articleTitle ? [articleTitle] : industry ? [industry] : [],
      status: "pending",
      metadata: jobMetadata,
    });

    if (jobError) {
      console.error("Failed to create article job:", jobError);
      return NextResponse.json(
        { error: "Failed to create article job" },
        { status: 500 },
      );
    }

    // 預扣篇數（現在 article_job 已存在，FK 約束不會失敗）
    const reservationResult = await quotaService.reserveArticles(
      billingId,
      articleJobId,
      1, // 1 篇文章
    );

    if (!reservationResult.success) {
      console.warn(
        `額度不足: 可用 ${reservationResult.availableArticles} 篇（已預扣 ${reservationResult.totalReserved} 篇）`,
      );
      await supabase.from("article_jobs").delete().eq("id", articleJobId);
      return NextResponse.json(
        {
          error: "Insufficient quota",
          message: `額度不足：可用 ${reservationResult.availableArticles} 篇（已有 ${reservationResult.totalReserved} 篇進行中）`,
          availableArticles: reservationResult.availableArticles,
          reservedArticles: reservationResult.totalReserved,
          upgradeUrl: "/dashboard/subscription",
        },
        { status: 402 },
      );
    }

    // 建立 SearchRouter 用於競爭對手分析配額檢查
    const searchRouter = createSearchRouter({
      companyId: billingId,
      enableCache: true,
    });

    // 如果有競爭對手，檢查配額
    let competitorAnalysisResult = null;
    if (competitors && Array.isArray(competitors) && competitors.length > 0) {
      competitorAnalysisResult =
        await searchRouter.analyzeCompetitors(competitors);

      if (!competitorAnalysisResult.allowed) {
        await quotaService.releaseReservation(articleJobId);
        await supabase.from("article_jobs").delete().eq("id", articleJobId);
        return NextResponse.json(
          {
            error: "Quota exceeded",
            message: competitorAnalysisResult.message,
          },
          { status: 403 },
        );
      }

      // 更新 job metadata 加入競爭對手分析結果
      jobMetadata.competitorAnalysis =
        competitorAnalysisResult?.results || null;
      await supabase
        .from("article_jobs")
        .update({ metadata: jobMetadata })
        .eq("id", articleJobId);
    }

    // 任務已創建（status: pending），由 GitHub Actions 每分鐘執行 process-article-jobs.yml 來處理
    // 這樣可以避免 Vercel 300 秒 timeout 限制
    console.log(
      `[Generate API] 任務已創建: ${articleJobId}，等待 GitHub Actions 處理`,
    );

    // 🔧 優化：設置 Redis flag 通知有待處理任務
    if (isRedisAvailable()) {
      await cacheSet(
        CACHE_CONFIG.PENDING_ARTICLE_JOBS.prefix,
        true,
        CACHE_CONFIG.PENDING_ARTICLE_JOBS.ttl,
      ).catch((err) => {
        // Redis 失敗不影響主流程
        console.warn("[Generate API] Redis flag 設置失敗:", err);
      });
    }

    // 🔧 優化：觸發 GitHub Actions 立即處理（非阻塞）
    triggerGitHubWorkflow(articleJobId).catch(() => {});

    return NextResponse.json({
      success: true,
      articleJobId,
      message: "文章生成任務已建立，將在背景處理中",
    });
  } catch (error) {
    console.error("Generate article error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
