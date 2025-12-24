import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { extendSubscription } from "@/lib/admin/admin-service";

/**
 * POST /api/admin/subscriptions/[companyId]/extend
 * 延長訂閱期限
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    const { companyId } = await params;
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

    // 解析請求內容
    const body = await request.json();
    const { days, reason } = body;

    if (!days || typeof days !== "number" || days <= 0) {
      return NextResponse.json(
        { success: false, error: "請提供有效的延長天數" },
        { status: 400 },
      );
    }

    // 執行延長
    await extendSubscription({
      companyId,
      days,
      adminUserId: user.id,
      adminEmail: user.email || "",
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `已成功延長 ${days} 天`,
    });
  } catch (error) {
    console.error("[API] /admin/subscriptions/extend error:", error);
    const message = error instanceof Error ? error.message : "延長訂閱失敗";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
