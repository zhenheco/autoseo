/**
 * 社群點數套餐 API
 *
 * GET /api/social/credits/packages - 取得可購買的點數套餐
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialCreditService } from "@/lib/social/social-credit-service";

export async function GET() {
  try {
    const supabase = await createClient();

    // 取得當前用戶（驗證已登入）
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 取得可用套餐
    const creditService = createSocialCreditService(supabase);
    const packages = await creditService.getActivePackages();

    return NextResponse.json({ packages });
  } catch (error) {
    console.error("[API] 取得點數套餐失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取得點數套餐失敗",
      },
      { status: 500 },
    );
  }
}
