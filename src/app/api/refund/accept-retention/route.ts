import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

interface AcceptRetentionBody {
  refundId: string;
}

/**
 * POST /api/refund/accept-retention
 * 接受慰留方案（贈送 50% credits）
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
    const body: AcceptRetentionBody = await request.json();

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
      .select("id, company_id")
      .eq("id", body.refundId)
      .single();

    if (!refund || refund.company_id !== member.company_id) {
      return NextResponse.json(
        { success: false, error: "退款申請不存在或無權限" },
        { status: 403 },
      );
    }

    // 接受慰留方案
    const refundService = RefundService.createInstance();
    const result = await refundService.acceptRetention(body.refundId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      creditsAdded: result.creditsAdded,
      message: `感謝您的支持！已為您新增 ${result.creditsAdded} credits`,
    });
  } catch (error) {
    console.error("[API] /refund/accept-retention error:", error);
    return NextResponse.json(
      { success: false, error: "處理慰留方案失敗" },
      { status: 500 },
    );
  }
}
