import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";

/**
 * 取消文章生成任務
 *
 * 篇數制計費邏輯：
 * - 文章只有在「完成」時才會被扣篇
 * - 取消任務時只需釋放預扣，不會扣篇
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  try {
    const supabase = await createClient();

    // 1. 驗證用戶權限
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. 查詢任務狀態
    const { data: job, error: jobError } = await supabase
      .from("article_jobs")
      .select("id, status, progress, company_id")
      .eq("id", jobId)
      .eq("company_id", membership.company_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "任務不存在" }, { status: 404 });
    }

    // 3. 檢查狀態（只能取消 pending 或 processing）
    if (job.status !== "pending" && job.status !== "processing") {
      return NextResponse.json(
        { error: `無法取消 ${job.status} 狀態的任務` },
        { status: 400 },
      );
    }

    const progress = job.progress || 0;

    // 4. 更新任務狀態為 cancelled
    const { error: updateError } = await supabase
      .from("article_jobs")
      .update({
        status: "cancelled",
        error_message: `用戶取消生成（進度 ${progress}%）`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Error updating job status:", updateError);
      return NextResponse.json({ error: "更新狀態失敗" }, { status: 500 });
    }

    // 5. 釋放預扣（篇數制：文章未完成就不扣篇）
    const quotaService = new ArticleQuotaService(supabase);
    await quotaService.releaseReservation(jobId);

    // 注意：不刪除任務記錄，讓 orchestrator 可以檢查取消狀態
    // 任務會保留在列表中顯示「已取消」狀態

    return NextResponse.json({
      success: true,
      message: "任務已取消，額度已退還",
    });
  } catch (error) {
    console.error("Error cancelling article:", error);
    return NextResponse.json({ error: "取消失敗" }, { status: 500 });
  }
}
