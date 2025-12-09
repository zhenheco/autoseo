import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/refund/[refundNo]/status
 * 查詢退款狀態
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refundNo: string }> },
) {
  try {
    const { refundNo } = await params;

    if (!refundNo) {
      return NextResponse.json(
        { success: false, error: "請提供退款單號" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 取得用戶的公司
    const { data: member } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { success: false, error: "找不到公司資訊" },
        { status: 404 },
      );
    }

    // 查詢退款狀態
    const refundService = RefundService.createInstance();
    const refund = await refundService.getRefundStatus(refundNo);

    if (!refund) {
      return NextResponse.json(
        { success: false, error: "找不到退款申請" },
        { status: 404 },
      );
    }

    // 驗證退款申請屬於該用戶的公司
    if (refund.company_id !== member.company_id) {
      return NextResponse.json(
        { success: false, error: "無權限查看此退款申請" },
        { status: 403 },
      );
    }

    // 狀態文字對應
    const statusText: Record<string, string> = {
      pending: "待處理",
      retention_accepted: "已接受慰留方案",
      auto_processing: "自動處理中",
      pending_review: "待人工審核",
      approved: "已核准",
      processing: "退款處理中",
      completed: "退款完成",
      rejected: "已拒絕",
      failed: "退款失敗",
    };

    return NextResponse.json({
      success: true,
      refund: {
        refundNo: refund.refund_no,
        status: refund.status,
        statusText: statusText[refund.status] || refund.status,
        originalAmount: refund.original_amount,
        refundAmount: refund.refund_amount,
        reasonCategory: refund.reason_category,
        reasonDetail: refund.reason_detail,
        retentionAccepted: refund.retention_accepted,
        retentionCredits: refund.retention_credits,
        creditsDeducted: refund.credits_deducted,
        subscriptionDowngraded: refund.subscription_downgraded,
        rejectReason: refund.reject_reason,
        requestedAt: refund.requested_at,
        completedAt: refund.completed_at,
      },
    });
  } catch (error) {
    console.error("[API] /refund/[refundNo]/status error:", error);
    return NextResponse.json(
      { success: false, error: "查詢退款狀態失敗" },
      { status: 500 },
    );
  }
}
