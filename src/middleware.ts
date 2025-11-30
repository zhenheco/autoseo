import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const runtime = "nodejs";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  // 基礎安全 Headers
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // 權限政策 - 限制瀏覽器功能
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
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
    // 加入 Cloudflare Insights 域名
    isDevelopment
      ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com"
      : "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    // style-src: 需要 unsafe-inline 支援 Tailwind CSS
    "style-src 'self' 'unsafe-inline'",
    // img-src: 允許所有 HTTPS 圖片來源（用於文章圖片）
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // connect-src: 允許 API 連接和 WebSocket，加入 Cloudflare beacon 回報端點
    [
      "connect-src 'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://api.openai.com",
      "https://api.deepseek.com",
      "https://api.perplexity.ai",
      "https://generativelanguage.googleapis.com",
      "https://ccore.newebpay.com",
      "https://accounts.google.com",
      "https://oauth2.googleapis.com",
      "https://www.googleapis.com",
      "https://cloudflareinsights.com",
    ].join(" "),
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self' https://ccore.newebpay.com https://core.newebpay.com",
  ];

  response.headers.set("Content-Security-Policy", cspDirectives.join("; "));

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
