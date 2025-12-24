import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils/admin-check";
import { grantArticles } from "@/lib/admin/admin-service";

/**
 * POST /api/admin/subscriptions/[companyId]/grant-articles
 * 贈送額外篇數
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
    const { articles, reason } = body;

    if (!articles || typeof articles !== "number" || articles <= 0) {
      return NextResponse.json(
        { success: false, error: "請提供有效的篇數" },
        { status: 400 },
      );
    }

    // 執行贈送
    await grantArticles({
      companyId,
      articles,
      adminUserId: user.id,
      adminEmail: user.email || "",
      reason,
    });

    return NextResponse.json({
      success: true,
      message: `已成功贈送 ${articles} 篇`,
    });
  } catch (error) {
    console.error("[API] /admin/subscriptions/grant-articles error:", error);
    const message = error instanceof Error ? error.message : "贈送篇數失敗";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
