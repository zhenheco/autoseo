import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { TokenBillingService } from "@/lib/billing/token-billing-service";

const RESERVED_TOKENS = 4000; // 預扣額度

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

    // 4. 計算扣款金額（按進度百分比）
    const progress = job.progress || 0;
    const tokensToDeduct =
      job.status === "pending"
        ? 0 // pending 狀態未開始，不扣款
        : Math.ceil((progress / 100) * RESERVED_TOKENS); // processing 狀態按進度扣款
    const tokensToRefund = RESERVED_TOKENS - tokensToDeduct;

    // 5. 更新任務狀態為 cancelled
    const { error: updateError } = await supabase
      .from("article_jobs")
      .update({
        status: "cancelled",
        error_message: `用戶取消生成（進度 ${progress}%，扣除 ${tokensToDeduct} tokens）`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (updateError) {
      console.error("Error updating job status:", updateError);
      return NextResponse.json({ error: "更新狀態失敗" }, { status: 500 });
    }

    // 6. 處理預扣退還
    const billingService = new TokenBillingService(supabase);

    if (tokensToDeduct > 0) {
      // 有部分使用，需要扣款後釋放剩餘
      // 先釋放預扣（這會把預扣額度返還）
      await billingService.releaseReservation(jobId);

      // 然後扣除實際使用的 tokens
      const { data: subscription } = await supabase
        .from("company_subscriptions")
        .select("monthly_quota_balance, purchased_token_balance")
        .eq("company_id", membership.company_id)
        .single();

      if (subscription) {
        // 優先從購買的 tokens 扣除
        let remainingToDeduct = tokensToDeduct;
        let newPurchased = subscription.purchased_token_balance || 0;
        let newMonthly = subscription.monthly_quota_balance || 0;

        if (newPurchased > 0) {
          const deductFromPurchased = Math.min(remainingToDeduct, newPurchased);
          newPurchased -= deductFromPurchased;
          remainingToDeduct -= deductFromPurchased;
        }

        if (remainingToDeduct > 0) {
          newMonthly = Math.max(0, newMonthly - remainingToDeduct);
        }

        await supabase
          .from("company_subscriptions")
          .update({
            purchased_token_balance: newPurchased,
            monthly_quota_balance: newMonthly,
          })
          .eq("company_id", membership.company_id);
      }
    } else {
      // pending 狀態，全額退還預扣
      await billingService.releaseReservation(jobId);
    }

    // 7. 刪除任務（級聯刪除相關資料）
    const { error: deleteError } = await supabase
      .from("article_jobs")
      .delete()
      .eq("id", jobId);

    if (deleteError) {
      console.error("Error deleting job:", deleteError);
      // 不返回錯誤，因為狀態已經更新為 cancelled
    }

    return NextResponse.json({
      success: true,
      message: `任務已取消`,
      tokensDeducted: tokensToDeduct,
      tokensRefunded: tokensToRefund,
    });
  } catch (error) {
    console.error("Error cancelling article:", error);
    return NextResponse.json({ error: "取消失敗" }, { status: 500 });
  }
}
