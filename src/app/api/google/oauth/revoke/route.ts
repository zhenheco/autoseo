import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decryptToken,
  revokeGoogleToken,
} from "@/lib/security/token-encryption";

/**
 * POST /api/google/oauth/revoke
 * 撤銷 Google OAuth 授權
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

    // 嘗試在 Google 端撤銷 token（可選）
    try {
      const accessToken = decryptToken(tokenRecord.access_token_encrypted);
      await revokeGoogleToken(accessToken);
    } catch (revokeError) {
      // 即使撤銷失敗，也繼續刪除本地記錄
      console.warn("[OAuth Revoke] Google 端撤銷失敗:", revokeError);
    }

    // 刪除本地 token 記錄
    const { error: deleteError } = await adminClient
      .from("google_oauth_tokens")
      .delete()
      .eq("id", tokenRecord.id);

    if (deleteError) {
      console.error("[OAuth Revoke] 刪除記錄失敗:", deleteError);
      return NextResponse.json({ error: "刪除記錄失敗" }, { status: 500 });
    }

    // 同時刪除相關的快取數據
    await adminClient
      .from("analytics_data_cache")
      .delete()
      .eq("website_id", website_id)
      .like("data_type", `${service_type}_%`);

    return NextResponse.json({
      success: true,
      message: `${service_type.toUpperCase()} 授權已撤銷`,
    });
  } catch (error) {
    console.error("[OAuth Revoke] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
