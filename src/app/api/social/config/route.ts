/**
 * 社群帳號設定 API
 *
 * GET /api/social/config - 取得社群設定
 * POST /api/social/config - 儲存 API Key 設定
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserCompanyIdOrError } from "@/lib/auth/get-user-company";

/**
 * 取得社群帳號設定
 */
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

    // 取得社群設定
    const { data: config, error: configError } = await supabase
      .from("social_account_configs")
      .select("id, bas_user_id, is_active, last_synced_at, created_at")
      .eq("company_id", companyId)
      .single();

    if (configError && configError.code !== "PGRST116") {
      throw new Error(`查詢設定失敗: ${configError.message}`);
    }

    // 注意：不返回 API Key（敏感資料）
    return NextResponse.json({
      hasConfig: !!config,
      config: config
        ? {
            id: config.id,
            basUserId: config.bas_user_id,
            isActive: config.is_active,
            lastSyncedAt: config.last_synced_at,
            createdAt: config.created_at,
          }
        : null,
    });
  } catch (error) {
    console.error("[API] 取得社群設定失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "取得社群設定失敗",
      },
      { status: 500 },
    );
  }
}

/**
 * 儲存社群帳號設定（手動輸入 API Key）
 */
export async function POST(request: NextRequest) {
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

    // 解析請求
    const body = await request.json();
    const { basApiKey, basUserId } = body;

    if (!basApiKey || !basUserId) {
      return NextResponse.json(
        { error: "請提供 API Key 和 User ID" },
        { status: 400 },
      );
    }

    // 檢查是否已有設定
    const { data: existingConfig } = await supabase
      .from("social_account_configs")
      .select("id")
      .eq("company_id", companyId)
      .single();

    if (existingConfig) {
      // 更新現有設定
      const { error: updateError } = await supabase
        .from("social_account_configs")
        .update({
          bas_api_key: basApiKey,
          bas_user_id: basUserId,
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);

      if (updateError) {
        throw new Error(`更新設定失敗: ${updateError.message}`);
      }
    } else {
      // 建立新設定
      const { error: insertError } = await supabase
        .from("social_account_configs")
        .insert({
          company_id: companyId,
          bas_api_key: basApiKey,
          bas_user_id: basUserId,
          is_active: true,
        });

      if (insertError) {
        throw new Error(`建立設定失敗: ${insertError.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: "設定已儲存",
    });
  } catch (error) {
    console.error("[API] 儲存社群設定失敗:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "儲存社群設定失敗",
      },
      { status: 500 },
    );
  }
}
