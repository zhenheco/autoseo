/**
 * 社群點數餘額 API
 *
 * GET /api/social/credits - 取得目前公司的點數餘額
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSocialCreditService } from "@/lib/social/social-credit-service";

export async function GET() {
  try {
    const supabase = await createClient();

    // 取得當前用戶
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    // 取得用戶的公司 ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: "找不到公司資訊" }, { status: 404 });
    }

    // 取得點數餘額
    const creditService = createSocialCreditService(supabase);
    const balance = await creditService.getBalance(profile.company_id);

    return NextResponse.json({
      creditsRemaining: balance?.credits_remaining || 0,
      creditsUsed: balance?.credits_used || 0,
    });
  } catch (error) {
    console.error("[API] 取得點數餘額失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取得點數餘額失敗",
      },
      { status: 500 },
    );
  }
}
