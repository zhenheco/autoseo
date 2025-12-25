import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * GET /api/websites/[id]/health-check/[jobId]
 * 取得特定健康檢查任務的狀態和結果
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> },
) {
  try {
    const { id: websiteId, jobId } = await params;

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

    // 取得 job
    const { data: job, error: jobError } = await supabase
      .from("website_health_check_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("website_id", websiteId)
      .single();

    if (jobError) {
      if (jobError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Health check job not found" },
          { status: 404 },
        );
      }
      console.error("[Health Check API] Error fetching job:", jobError);
      return NextResponse.json(
        { error: "Failed to fetch health check job" },
        { status: 500 },
      );
    }

    // 驗證用戶有權限查看此 job
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", job.company_id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "You don't have access to this job" },
        { status: 403 },
      );
    }

    // 如果 job 已完成且有結果，取得結果
    let result = null;
    if (job.result_id) {
      const { data: resultData } = await supabase
        .from("website_health_checks")
        .select("*")
        .eq("id", job.result_id)
        .single();

      result = resultData;
    }

    return NextResponse.json({
      success: true,
      job,
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
