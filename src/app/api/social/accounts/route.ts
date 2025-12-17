/**
 * 社群帳號列表 API
 *
 * GET /api/social/accounts - 取得已連結的社群帳號
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // 取得已連結帳號（從快取表）
    const { data: accounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("company_id", profile.company_id)
      .order("platform", { ascending: true });

    if (accountsError) {
      throw new Error(`查詢帳號失敗: ${accountsError.message}`);
    }

    return NextResponse.json({
      accounts: accounts || [],
      total: accounts?.length || 0,
    });
  } catch (error) {
    console.error("[API] 取得社群帳號失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取得社群帳號失敗",
      },
      { status: 500 },
    );
  }
}
