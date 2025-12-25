import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { CreateHealthCheckJobRequest } from "@/types/health-check";

/**
 * POST /api/websites/[id]/health-check
 * 建立健康檢查任務（只建立 job，不執行檢查）
 *
 * 這個 API 設計為極輕量：
 * - 驗證用戶權限
 * - 建立 job 記錄
 * - 立即返回（< 200ms）
 *
 * 實際的健康檢查由 GitHub Actions 在背景處理
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: websiteId } = await params;
    const body: CreateHealthCheckJobRequest = await request.json();

    // 驗證用戶身份
    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 使用 service role client 進行資料庫操作
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 驗證網站存在且用戶有權限
    const { data: website, error: websiteError } = await supabase
      .from("website_configs")
      .select("id, wordpress_url, company_id")
      .eq("id", websiteId)
      .single();

    if (websiteError || !website) {
      console.error("[Health Check API] Website query error:", websiteError);
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    // 驗證用戶屬於該公司
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", website.company_id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this website" },
        { status: 403 },
      );
    }

    // 決定要檢查的 URL
    const urlToCheck = body.url || website.wordpress_url;

    if (!urlToCheck) {
      return NextResponse.json(
        {
          error:
            "No URL to check. Please provide a URL or configure the website URL.",
        },
        { status: 400 },
      );
    }

    // 建立健康檢查 job
    const { data: job, error: jobError } = await supabase
      .from("website_health_check_jobs")
      .insert({
        website_id: websiteId,
        company_id: website.company_id,
        status: "pending",
        url_to_check: urlToCheck,
        device_type: body.deviceType || "mobile",
        include_ai_recommendations: body.includeAiRecommendations ?? true,
      })
      .select()
      .single();

    if (jobError) {
      console.error("[Health Check API] Failed to create job:", jobError);
      return NextResponse.json(
        { error: "Failed to create health check job" },
        { status: 500 },
      );
    }

    console.log(`[Health Check API] Job created: ${job.id} for ${urlToCheck}`);

    // 觸發 GitHub Actions workflow（避免等待 cron schedule）
    try {
      const githubToken = process.env.GITHUB_TOKEN;
      const githubOwner = process.env.GITHUB_REPO_OWNER;
      const githubRepo = process.env.GITHUB_REPO_NAME;

      if (githubToken && githubOwner && githubRepo) {
        // 使用 AbortController 設定 5 秒超時（避免阻塞過久）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(
            `https://api.github.com/repos/${githubOwner}/${githubRepo}/dispatches`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: "application/vnd.github.v3+json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                event_type: "health-check-jobs-created",
                client_payload: {
                  jobId: job.id,
                  websiteId: websiteId,
                  timestamp: new Date().toISOString(),
                },
              }),
              signal: controller.signal,
            },
          );
          clearTimeout(timeoutId);

          if (response.ok) {
            console.log(
              `[Health Check API] ✅ Triggered GitHub Actions for job ${job.id}`,
            );
          } else {
            const errorText = await response.text();
            console.warn(
              `[Health Check API] ⚠️ Workflow trigger failed: ${response.status}`,
              errorText,
            );
            // 不影響 job 創建，讓定時任務處理
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === "AbortError") {
            console.warn(
              "[Health Check API] ⚠️ GitHub API timeout (5s), job will be processed by scheduler",
            );
          } else {
            console.error("[Health Check API] ❌ Trigger error:", fetchError);
          }
          // 不影響 job 創建，讓定時任務處理
        }
      } else {
        console.log(
          "[Health Check API] ⚠️ GitHub configuration incomplete, workflow will run on schedule",
        );
      }
    } catch (dispatchError) {
      console.error(
        "[Health Check API] ⚠️ Error triggering workflow:",
        dispatchError,
      );
      // 不影響 job 創建
    }

    return NextResponse.json({
      success: true,
      job,
      message: "健康檢查任務已建立，正在背景處理中",
    });
  } catch (error) {
    console.error("[Health Check API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}

/**
 * GET /api/websites/[id]/health-check
 * 取得最新的健康檢查結果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: websiteId } = await params;

    // 驗證用戶身份
    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 使用 service role client
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // 取得最新的 job
    const { data: latestJob, error: jobError } = await supabase
      .from("website_health_check_jobs")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (jobError && jobError.code !== "PGRST116") {
      console.error("[Health Check API] Error fetching job:", jobError);
      return NextResponse.json(
        { error: "Failed to fetch health check status" },
        { status: 500 },
      );
    }

    if (!latestJob) {
      return NextResponse.json({
        success: true,
        job: null,
        result: null,
        message: "No health check found for this website",
      });
    }

    // 如果 job 已完成且有結果，取得結果
    let result = null;
    if (latestJob.result_id) {
      const { data: resultData } = await supabase
        .from("website_health_checks")
        .select("*")
        .eq("id", latestJob.result_id)
        .single();

      result = resultData;
    }

    return NextResponse.json({
      success: true,
      job: latestJob,
      result,
    });
  } catch (error) {
    console.error("[Health Check API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
