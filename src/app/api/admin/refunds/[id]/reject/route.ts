import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

// 管理員 email 白名單
const ADMIN_EMAILS = ["avyshiu@gmail.com", "ace@marketermilk.com"];

interface RejectBody {
  rejectReason: string;
}

/**
 * POST /api/admin/refunds/[id]/reject
 * 管理員拒絕退款申請
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "請提供退款申請 ID" },
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

    // 驗證管理員權限
    if (!ADMIN_EMAILS.includes(user.email || "")) {
      return NextResponse.json(
        { success: false, error: "無管理員權限" },
        { status: 403 },
      );
    }

    // 解析請求內容
    const body: RejectBody = await request.json();

    if (!body.rejectReason) {
      return NextResponse.json(
        { success: false, error: "請提供拒絕原因" },
        { status: 400 },
      );
    }

    // 拒絕退款
    const refundService = RefundService.createInstance();
    const result = await refundService.rejectRefund(
      id,
      user.id,
      body.rejectReason,
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "退款申請已拒絕",
    });
  } catch (error) {
    console.error("[API] /admin/refunds/[id]/reject error:", error);
    return NextResponse.json(
      { success: false, error: "拒絕退款失敗" },
      { status: 500 },
    );
  }
}
