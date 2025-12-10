import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

/**
 * GET /api/google/oauth/authorize
 * 發起 Google OAuth 授權流程
 *
 * Query Parameters:
 * - website_id: 網站 ID
 * - service_type: 服務類型（gsc 或 ga4）
 */
export async function GET(request: NextRequest) {
  try {
    // 驗證用戶登入狀態
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    // 取得參數
    const searchParams = request.nextUrl.searchParams;
    const websiteId = searchParams.get("website_id");
    const serviceType = searchParams.get("service_type");

    if (!websiteId) {
      return NextResponse.json(
        { error: "缺少 website_id 參數" },
        { status: 400 },
      );
    }

    if (!serviceType || !["gsc", "ga4"].includes(serviceType)) {
      return NextResponse.json(
        { error: "service_type 必須是 gsc 或 ga4" },
        { status: 400 },
      );
    }

    // 驗證用戶有權限存取該網站
    const { data: website } = await supabase
      .from("website_configs")
      .select("id, company_id")
      .eq("id", websiteId)
      .single();

    if (!website) {
      return NextResponse.json({ error: "網站不存在" }, { status: 404 });
    }

    // 驗證用戶是該公司成員
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("company_id", website.company_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "無權限存取此網站" }, { status: 403 });
    }

    // 檢查環境變數
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      console.error("[OAuth Authorize] 缺少必要的環境變數");
      return NextResponse.json({ error: "伺服器設定錯誤" }, { status: 500 });
    }

    // 生成 state token 防止 CSRF
    const state = crypto.randomBytes(32).toString("hex");

    // 根據服務類型決定 scopes
    const scopes =
      serviceType === "gsc"
        ? ["https://www.googleapis.com/auth/webmasters.readonly"]
        : [
            "https://www.googleapis.com/auth/analytics.readonly",
            "https://www.googleapis.com/auth/analytics.edit", // 列出資源需要
          ];

    // 建立 OAuth URL
    const authParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent", // 強制顯示同意畫面以取得 refresh_token
      state: `${state}:${websiteId}:${serviceType}`,
    });

    const authUrl = `${GOOGLE_AUTH_URL}?${authParams.toString()}`;

    // 設定 cookies 儲存 state（用於驗證回調）
    const response = NextResponse.redirect(authUrl);

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600, // 10 分鐘
      path: "/",
    };

    response.cookies.set("google_oauth_state", state, cookieOptions);
    response.cookies.set("google_oauth_website_id", websiteId, cookieOptions);
    response.cookies.set(
      "google_oauth_service_type",
      serviceType,
      cookieOptions,
    );

    return response;
  } catch (error) {
    console.error("[OAuth Authorize] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
