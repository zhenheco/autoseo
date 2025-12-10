import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptToken,
  decryptToken,
  refreshGoogleToken,
} from "@/lib/security/token-encryption";

/**
 * POST /api/google/oauth/refresh
 * 刷新 Google OAuth token
 *
 * Body:
 * - website_id: 網站 ID
 * - service_type: 服務類型（gsc 或 ga4）
 */
export async function POST(request: NextRequest) {
  try {
    // 驗證用戶登入狀態
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const body = await request.json();
    const { website_id, service_type } = body;

    if (!website_id || !service_type) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }

    // 取得現有的 token 記錄
    const adminClient = createAdminClient();

    const { data: tokenRecord, error: fetchError } = await adminClient
      .from("google_oauth_tokens")
      .select("*")
      .eq("website_id", website_id)
      .eq("service_type", service_type)
      .single();

    if (fetchError || !tokenRecord) {
      return NextResponse.json({ error: "找不到 token 記錄" }, { status: 404 });
    }

    // 驗證用戶權限
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("company_id", tokenRecord.company_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "無權限" }, { status: 403 });
    }

    // 解密 refresh token
    let refreshToken: string;
    try {
      refreshToken = decryptToken(tokenRecord.refresh_token_encrypted);
    } catch (decryptError) {
      console.error("[OAuth Refresh] 解密 refresh token 失敗:", decryptError);

      // 標記 token 為錯誤狀態
      await adminClient
        .from("google_oauth_tokens")
        .update({
          status: "error",
          last_error: "Token 解密失敗，請重新授權",
        })
        .eq("id", tokenRecord.id);

      return NextResponse.json(
        { error: "Token 解密失敗，請重新授權" },
        { status: 400 },
      );
    }

    // 刷新 token
    const result = await refreshGoogleToken(refreshToken);

    if (result.error) {
      console.error("[OAuth Refresh] 刷新失敗:", result);

      // 標記 token 為過期狀態
      await adminClient
        .from("google_oauth_tokens")
        .update({
          status: "expired",
          last_error: result.error_description || result.error,
        })
        .eq("id", tokenRecord.id);

      return NextResponse.json(
        { error: result.error_description || "Token 刷新失敗，請重新授權" },
        { status: 401 },
      );
    }

    // 更新儲存的 token
    const { error: updateError } = await adminClient
      .from("google_oauth_tokens")
      .update({
        access_token_encrypted: encryptToken(result.access_token),
        token_expires_at: new Date(
          Date.now() + result.expires_in * 1000,
        ).toISOString(),
        status: "active",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenRecord.id);

    if (updateError) {
      console.error("[OAuth Refresh] 更新 token 失敗:", updateError);
      return NextResponse.json({ error: "更新 token 失敗" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      expires_at: new Date(Date.now() + result.expires_in * 1000).toISOString(),
    });
  } catch (error) {
    console.error("[OAuth Refresh] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
