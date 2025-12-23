import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  COUNTRY_TO_LOCALE,
  DEFAULT_UI_LOCALE,
  UI_LOCALE_COOKIE_KEY,
} from "@/lib/i18n/locales";

export const runtime = "nodejs";

// Request Body 大小限制（10MB）
const MAX_BODY_SIZE = 10 * 1024 * 1024;

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "";

  // ========== Request Body 大小檢查 ==========
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const bodySize = parseInt(contentLength, 10);
    if (!isNaN(bodySize) && bodySize > MAX_BODY_SIZE) {
      return new NextResponse(
        JSON.stringify({ error: "Request body too large" }),
        {
          status: 413,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  // ========== 生產環境：HTTP → HTTPS + www → non-www 301 重導向 ==========
  if (process.env.NODE_ENV === "production") {
    // 檢查 x-forwarded-proto header（Vercel/Cloudflare 會設置）
    const proto = request.headers.get("x-forwarded-proto");
    const isHttp = proto === "http";
    const hasWww = host.startsWith("www.");

    if (isHttp || hasWww) {
      // 構建新的 URL
      const newHost = hasWww ? host.slice(4) : host; // 移除 www.
      const redirectUrl = `https://${newHost}${url.pathname}${url.search}`;

      return NextResponse.redirect(redirectUrl, {
        status: 301,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  // Debug 端點：生產環境完全禁用，開發環境允許訪問
  if (request.nextUrl.pathname.startsWith("/api/debug")) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  let response: NextResponse;
  try {
    response = await updateSession(request);
  } catch (error) {
    console.error("[Middleware Error]:", error);
    // 如果 updateSession 失敗，返回基本 response
    response = NextResponse.next({ request });
  }

  // 基礎安全 Headers
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // 權限政策 - 限制瀏覽器功能
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Cross-Origin Headers
  response.headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  response.headers.set(
    "Cross-Origin-Opener-Policy",
    "same-origin-allow-popups",
  );
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // HSTS - 只在生產環境啟用
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Content Security Policy - 根據環境調整
  const isDevelopment = process.env.NODE_ENV === "development";

  const cspDirectives = [
    "default-src 'self'",
    // script-src: 開發環境需要 unsafe-eval (Next.js HMR)，生產環境移除
    // 加入 Cloudflare Insights 和 Google Tag Manager 域名
    isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com"
      : "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://www.googletagmanager.com https://www.google-analytics.com https://ssl.google-analytics.com https://tagmanager.google.com",
    // style-src: 需要 unsafe-inline 支援 Tailwind CSS
    "style-src 'self' 'unsafe-inline'",
    // img-src: 允許所有 HTTPS 圖片來源（用於文章圖片）
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // connect-src: 允許 API 連接和 WebSocket，加入 Cloudflare beacon 和 Google Analytics 回報端點
    [
      "connect-src 'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://api.openai.com",
      "https://api.deepseek.com",
      "https://api.perplexity.ai",
      "https://generativelanguage.googleapis.com",
      // PAYUNi 金流微服務（已移除藍新金流）
      "https://api.payuni.com.tw",
      "https://affiliate.1wayseo.com",
      "https://sandbox.affiliate.1wayseo.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://www.googleapis.com",
      "https://cloudflareinsights.com",
      // Google Analytics 和 Search Console API
      "https://www.google-analytics.com",
      "https://ssl.google-analytics.com",
      "https://analytics.google.com",
      "https://region1.google-analytics.com",
      "https://stats.g.doubleclick.net",
      "https://searchconsole.googleapis.com",
      "https://analyticsdata.googleapis.com",
      "https://analyticsadmin.googleapis.com",
    ].join(" "),
    "frame-ancestors 'self'",
    "base-uri 'self'",
    // 金流表單提交（PAYUNi 正式環境）
    "form-action 'self' https://api.payuni.com.tw https://ccore.newebpay.com https://core.newebpay.com",
  ];

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "));

  // IP 偵測語系：只有首次訪問（沒有 ui-locale cookie）時才設定
  const existingLocale = request.cookies.get(UI_LOCALE_COOKIE_KEY)?.value;

  if (!existingLocale) {
    // 讀取 IP 國家代碼（Cloudflare 或 Vercel 提供）
    const ipCountry =
      request.headers.get("cf-ipcountry") ||
      request.headers.get("x-vercel-ip-country");

    // 根據國家代碼決定語系，找不到則使用預設值
    const detectedLocale = ipCountry
      ? COUNTRY_TO_LOCALE[ipCountry] || DEFAULT_UI_LOCALE
      : DEFAULT_UI_LOCALE;

    // 設定 cookie（有效期 1 年）
    response.cookies.set(UI_LOCALE_COOKIE_KEY, detectedLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 年
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/debug (debug endpoints)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/debug|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
