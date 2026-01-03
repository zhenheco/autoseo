/**
 * 社群帳號列表 API
 *
 * GET /api/social/accounts - 取得已連結的社群帳號
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserCompanyIdOrError } from "@/lib/auth/get-user-company";

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

    // 取得用戶的公司 ID（使用 company_members 表，統一查詢邏輯）
    const { companyId, errorResponse } = await getUserCompanyIdOrError(
      supabase,
      user.id,
    );

    if (errorResponse) {
      return NextResponse.json(errorResponse, { status: 403 });
    }

    // 取得已連結帳號（從快取表）
    const { data: accounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("*")
      .eq("company_id", companyId)
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
