import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const jobId = searchParams.get("jobId");

    if (!jobId) {
      return NextResponse.json(
        { error: "Job ID is required" },
        { status: 400 },
      );
    }

    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 使用 service role client 避免 RLS 問題
    const { createClient: createSupabaseClient } = await import(
      "@supabase/supabase-js"
    );
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: job, error } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.user_id !== user.id) {
      const { data: membership } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (!membership || membership.company_id !== job.company_id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // 如果任務已完成，返回生成的內容
    if (job.status === "completed") {
      return NextResponse.json({
        status: job.status,
        progress: 100,
        article: {
          title: job.article_title,
          content: job.generated_content,
          meta_description: job.metadata?.result?.meta?.description,
        },
        fullResult: job.metadata?.result, // 完整結果
        metadata: job.metadata,
        completedAt: job.completed_at,
      });
    }

    // 根據狀態計算進度
    let progress = 0;
    let message = "";

    switch (job.status) {
      case "pending":
        progress = 0;
        message = "任務排隊中...";
        break;
      case "processing":
        progress = 50;
        message = "正在生成文章...";
        // 如果有更詳細的進度資訊
        if (job.metadata?.progress) {
          progress = job.metadata.progress;
        }
        if (job.metadata?.currentStep) {
          message = job.metadata.currentStep;
        }
        break;
      case "completed":
        progress = 100;
        message = "文章生成完成！";
        break;
      case "failed":
        progress = 0;
        message = `生成失敗: ${job.error_message || "未知錯誤"}`;
        break;
    }

    return NextResponse.json({
      status: job.status,
      progress,
      message,
      metadata: job.metadata,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      error: job.error_message,
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
