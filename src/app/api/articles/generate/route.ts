import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import {
  TokenBillingService,
  ESTIMATED_TOKENS_PER_ARTICLE,
} from "@/lib/billing/token-billing-service";
import { createSearchRouter } from "@/lib/search/search-router";
import {
  checkFreeTrialLimit,
  incrementFreeTrialUsage,
} from "@/lib/quota/free-trial-service";
import { processArticleJob } from "@/lib/article-processor";

export const maxDuration = 300;

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

    // 嘗試獲取 company_id（如果用戶有加入公司），否則使用 user_id
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    // 使用 company_id 或 user_id 作為 billing identifier
    const billingId = membership?.company_id || user.id;

    // 檢查免費方案終身配額
    const { data: company } = await supabase
      .from("companies")
      .select("subscription_tier")
      .eq("id", billingId)
      .single();

    const subscriptionTier = company?.subscription_tier || "free";

    if (subscriptionTier === "free") {
      const freeTrialStatus = await checkFreeTrialLimit(supabase, billingId);

      if (!freeTrialStatus.canGenerate) {
        return NextResponse.json(
          {
            error: "FREE_LIMIT_EXCEEDED",
            message: `免費試用已達上限 ${freeTrialStatus.limit} 篇，請升級方案繼續使用`,
            used: freeTrialStatus.used,
            limit: freeTrialStatus.limit,
            upgradeUrl: "/dashboard/subscription",
          },
          { status: 403 },
        );
      }
    }

    const billingService = new TokenBillingService(supabase);
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

    // 先創建 article_job（因為 token_reservations 有 FK 約束引用 article_jobs）
    const { error: jobError } = await supabase.from("article_jobs").insert({
      id: articleJobId,
      job_id: articleJobId,
      company_id: billingId,
      website_id: websiteId,
      user_id: user.id,
      keywords: industry ? [industry] : [articleTitle],
      status: "pending",
      metadata: {
        mode: mode || "single",
        title: articleTitle,
        industry: industry || null,
        region: region || null,
        language: language || null,
        competitors: competitors || [],
        competitorAnalysis: null,
      },
    });

    if (jobError) {
      console.error("Failed to create article job:", jobError);
      return NextResponse.json(
        { error: "Failed to create article job" },
        { status: 500 },
      );
    }

    // 預扣 tokens（現在 article_job 已存在，FK 約束不會失敗）
    const reservationResult = await billingService.checkAndReserveTokens(
      billingId,
      articleJobId,
      1,
    );

    if (!reservationResult.success) {
      console.warn(
        `餘額不足: 可用 ${reservationResult.availableBalance} tokens（已預扣 ${reservationResult.totalReserved}），需要 ${reservationResult.requiredAmount} tokens`,
      );
      await supabase.from("article_jobs").delete().eq("id", articleJobId);
      return NextResponse.json(
        {
          error: "Insufficient balance",
          message: `餘額不足：可用 ${reservationResult.availableBalance.toLocaleString()} tokens（已有 ${reservationResult.totalReserved.toLocaleString()} 進行中），預估需要 ${reservationResult.requiredAmount.toLocaleString()} tokens`,
          availableBalance: reservationResult.availableBalance,
          reservedBalance: reservationResult.totalReserved,
          estimatedCost: reservationResult.requiredAmount,
          upgradeUrl: "/dashboard/billing/upgrade",
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
        await billingService.releaseReservation(articleJobId);
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
      await supabase
        .from("article_jobs")
        .update({
          metadata: {
            mode: mode || "single",
            title: articleTitle,
            industry: industry || null,
            region: region || null,
            language: language || null,
            competitors: competitors || [],
            competitorAnalysis: competitorAnalysisResult?.results || null,
          },
        })
        .eq("id", articleJobId);
    }

    // 免費方案：遞增終身使用量
    if (subscriptionTier === "free") {
      await incrementFreeTrialUsage(supabase, billingId, articleJobId);
    }

    // 使用 after() 在回應後立即開始處理
    // 這樣用戶可以立即看到回應，同時後台開始處理
    after(async () => {
      console.log(`[Generate API] 開始後台處理任務: ${articleJobId}`);
      await processArticleJob(articleJobId);
    });

    return NextResponse.json({
      success: true,
      articleJobId,
      message: "文章生成已開始，正在後台處理中",
    });
  } catch (error) {
    console.error("Generate article error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
