import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";
import { isAdminEmail } from "@/lib/utils/admin-check";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/refunds
 * 管理員取得所有退款申請列表
 */
export async function GET(request: NextRequest) {
  try {
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

    // 驗證管理員權限
    if (!isAdminEmail(user.email)) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 解析查詢參數
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    // 查詢退款申請
    const refundService = RefundService.createInstance();
    const { data, total } = await refundService.getRefundRequests(
      status,
      page,
      limit,
    );

    // 狀態文字對應
    const statusText: Record<string, string> = {
      pending: "待處理",
      retention_accepted: "已接受慰留",
      auto_processing: "自動處理中",
      pending_review: "待審核",
      approved: "已核准",
      processing: "處理中",
      completed: "已完成",
      rejected: "已拒絕",
      failed: "失敗",
    };

    // 格式化數據
    const formattedData = data.map((refund: any) => ({
      id: refund.id,
      refundNo: refund.refund_no,
      companyName: refund.companies?.name || "未知",
      orderNo: refund.payment_orders?.order_no || "未知",
      paymentType: refund.payment_orders?.payment_type || "未知",
      originalAmount: refund.original_amount,
      refundAmount: refund.refund_amount,
      status: refund.status,
      statusText: statusText[refund.status] || refund.status,
      isAutoEligible: refund.is_auto_eligible,
      daysSincePurchase: refund.days_since_purchase,
      reasonCategory: refund.reason_category,
      reasonDetail: refund.reason_detail,
      retentionAccepted: refund.retention_accepted,
      retentionCredits: refund.retention_credits,
      requestedAt: refund.requested_at,
      completedAt: refund.completed_at,
      reviewedAt: refund.reviewed_at,
      rejectReason: refund.reject_reason,
    }));

    return NextResponse.json({
      success: true,
      data: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[API] /admin/refunds error:", error);
    return NextResponse.json(
      { success: false, error: "查詢退款申請失敗" },
      { status: 500 },
    );
  }
}
