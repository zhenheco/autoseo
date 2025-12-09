import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

interface ProceedRefundBody {
  refundId: string;
}

/**
 * POST /api/refund/proceed
 * 繼續退款（拒絕慰留方案）
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
    const body: ProceedRefundBody = await request.json();

    if (!body.refundId) {
      return NextResponse.json(
        { success: false, error: "請提供退款申請 ID" },
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

    // 驗證退款申請屬於該用戶的公司
    const { data: refund } = await supabase
      .from("refund_requests")
      .select("id, company_id, is_auto_eligible, refund_no")
      .eq("id", body.refundId)
      .single();

    if (!refund || refund.company_id !== member.company_id) {
      return NextResponse.json(
        { success: false, error: "退款申請不存在或無權限" },
        { status: 403 },
      );
    }

    // 繼續退款流程
    const refundService = RefundService.createInstance();
    const result = await refundService.proceedWithRefund(body.refundId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    // 根據狀態返回不同訊息
    if (result.status === "completed") {
      return NextResponse.json({
        success: true,
        status: "completed",
        refundNo: refund.refund_no,
        message: "退款申請已完成，款項將於 7-14 個工作天內退回您的信用卡",
      });
    } else if (result.status === "pending_review") {
      return NextResponse.json({
        success: true,
        status: "pending_review",
        refundNo: refund.refund_no,
        message: "退款申請已提交，將由客服人員審核，預計 3-5 個工作天內回覆",
      });
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      refundNo: refund.refund_no,
    });
  } catch (error) {
    console.error("[API] /refund/proceed error:", error);
    return NextResponse.json(
      { success: false, error: "處理退款申請失敗" },
      { status: 500 },
    );
  }
}
