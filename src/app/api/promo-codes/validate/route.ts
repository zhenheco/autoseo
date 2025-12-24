import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePromoCode } from "@/lib/admin/promo-code-service";

/**
 * POST /api/promo-codes/validate
 * 驗證優惠碼（公開 API，用於付款前驗證）
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

    // 取得用戶的公司 ID
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json(
        { success: false, error: "找不到您的公司資訊" },
        { status: 400 },
      );
    }

    // 解析請求內容
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { success: false, error: "請提供優惠碼" },
        { status: 400 },
      );
    }

    // 驗證優惠碼
    const result = await validatePromoCode(code, membership.company_id);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        code: result.promoCode?.code,
        name: result.promoCode?.name,
        bonusArticles: result.bonusArticles,
        description: result.promoCode?.description,
      },
      message: `優惠碼有效！每月加送 ${result.bonusArticles} 篇`,
    });
  } catch (error) {
    console.error("[API] /promo-codes/validate error:", error);
    return NextResponse.json(
      { success: false, error: "驗證優惠碼失敗" },
      { status: 500 },
    );
  }
}
