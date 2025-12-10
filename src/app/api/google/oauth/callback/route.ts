import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptToken,
  fetchGoogleUserInfo,
} from "@/lib/security/token-encryption";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * GET /api/google/oauth/callback
 * 處理 Google OAuth 回調
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // 建立重定向 URL 的輔助函數
  const redirectToWebsites = (params: Record<string, string>) => {
    const url = new URL("/dashboard/websites", request.url);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    return NextResponse.redirect(url);
  };

  // 處理錯誤
  if (error) {
    console.error("[OAuth Callback] Google 返回錯誤:", error);
    return redirectToWebsites({ error: error });
  }

  // 驗證 state
  const savedState = request.cookies.get("google_oauth_state")?.value;
  const websiteId = request.cookies.get("google_oauth_website_id")?.value;
  const serviceType = request.cookies.get("google_oauth_service_type")?.value;

  if (!state || !savedState || !state.startsWith(savedState)) {
    console.error("[OAuth Callback] State 驗證失敗");
    return redirectToWebsites({ error: "invalid_state" });
  }

  if (!websiteId || !serviceType) {
    console.error("[OAuth Callback] 缺少必要的 cookie 資訊");
    return redirectToWebsites({ error: "missing_session" });
  }

  if (!code) {
    console.error("[OAuth Callback] 缺少授權碼");
    return redirectToWebsites({ error: "missing_code" });
  }

  try {
    // 驗證用戶登入狀態
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectToWebsites({ error: "unauthorized" });
    }

    // 取得用戶的 company_id
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return redirectToWebsites({ error: "no_company" });
    }

    // 交換 code 取得 tokens
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      console.error("[OAuth Callback] 缺少環境變數");
      return redirectToWebsites({ error: "server_config_error" });
    }

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error("[OAuth Callback] Token 交換失敗:", tokens);
      return redirectToWebsites({ error: tokens.error });
    }

    // 取得 Google 帳戶 email
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    // 加密並儲存 tokens
    const adminClient = createAdminClient();

    const tokenData = {
      website_id: websiteId,
      company_id: membership.company_id,
      service_type: serviceType,
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: encryptToken(tokens.refresh_token),
      token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString(),
      scopes: tokens.scope.split(" "),
      google_account_email: userInfo?.email || null,
      status: "active" as const,
      updated_at: new Date().toISOString(),
    };

    // 使用 upsert 來插入或更新記錄
    const { error: upsertError } = await adminClient
      .from("google_oauth_tokens")
      .upsert(tokenData, {
        onConflict: "website_id,service_type",
      });

    if (upsertError) {
      console.error("[OAuth Callback] 儲存 token 失敗:", upsertError);
      return redirectToWebsites({ error: "storage_failed" });
    }

    // 清除臨時 cookies 並重定向
    const response = NextResponse.redirect(
      new URL(
        `/dashboard/websites/${websiteId}?success=google_connected&service=${serviceType}`,
        request.url,
      ),
    );

    response.cookies.delete("google_oauth_state");
    response.cookies.delete("google_oauth_website_id");
    response.cookies.delete("google_oauth_service_type");

    return response;
  } catch (error) {
    console.error("[OAuth Callback] 處理錯誤:", error);
    return redirectToWebsites({ error: "server_error" });
  }
}
