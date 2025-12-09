import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

interface RefundRequestBody {
  orderId: string;
  reasonCategory:
    | "product_issue"
    | "service_unsatisfied"
    | "billing_error"
    | "change_of_mind"
    | "other";
  reasonDetail?: string;
}

/**
 * POST /api/refund/request
 * 用戶申請退款
 */
export async function POST(request: NextRequest) {
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

    // 解析請求內容
    const body: RefundRequestBody = await request.json();

    if (!body.orderId || !body.reasonCategory) {
      return NextResponse.json(
        { success: false, error: "請提供完整的退款資訊" },
        { status: 400 },
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

    // 驗證訂單屬於該用戶的公司
    const { data: order } = await supabase
      .from("payment_orders")
      .select("id, company_id")
      .eq("id", body.orderId)
      .single();

    if (!order || order.company_id !== member.company_id) {
      return NextResponse.json(
        { success: false, error: "訂單不存在或無權限" },
        { status: 403 },
      );
    }

    // 創建退款申請
    const refundService = RefundService.createInstance();
    const result = await refundService.createRefundRequest({
      companyId: member.company_id,
      paymentOrderId: body.orderId,
      reasonCategory: body.reasonCategory,
      reasonDetail: body.reasonDetail,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      refundNo: result.refundNo,
      refundId: result.refundId,
      showRetentionOffer: true,
      retentionCredits: result.eligibility?.retentionCredits || 0,
      isAutoEligible: result.eligibility?.isAutoEligible || false,
      daysSincePurchase: result.eligibility?.daysSincePurchase || 0,
      message: result.eligibility?.isAutoEligible
        ? "您的退款申請符合自動退款條件"
        : "您的退款申請需要人工審核",
    });
  } catch (error) {
    console.error("[API] /refund/request error:", error);
    return NextResponse.json(
      { success: false, error: "創建退款申請失敗" },
      { status: 500 },
    );
  }
}
