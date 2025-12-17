/**
 * 用戶資料 API
 *
 * GET /api/user/profile - 取得當前用戶的基本資料
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

    // 取得用戶的 profile 資料
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: "找不到用戶資料" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      companyId: profile?.company_id || null,
    });
  } catch (error) {
    console.error("[API] 取得用戶資料失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取得用戶資料失敗",
      },
      { status: 500 },
    );
  }
}
