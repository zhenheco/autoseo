import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getAffiliateCodeFromUrl,
  getAffiliateCodeFromCookie,
  getAffiliateCookieOptions,
  validateAffiliateCode,
  logTrackingEvent,
} from "@/lib/affiliate/tracking";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 400 * 24 * 60 * 60,
      },
    },
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ===== 聯盟行銷追蹤邏輯 =====
  // 檢查 URL 是否包含推薦碼參數 ?ref=CODE
  const affiliateCodeFromUrl = getAffiliateCodeFromUrl(request);
  const existingAffiliateCode = getAffiliateCodeFromCookie(request);

  if (affiliateCodeFromUrl && validateAffiliateCode(affiliateCodeFromUrl)) {
    // 如果 URL 有推薦碼且格式正確，設定 Cookie（30天）
    const cookieOptions = getAffiliateCookieOptions();
    supabaseResponse.cookies.set(
      "affiliate_ref",
      affiliateCodeFromUrl,
      cookieOptions,
    );

    // 記錄 'click' 事件（只在新的推薦碼或不同推薦碼時記錄）
    if (
      affiliateCodeFromUrl !== existingAffiliateCode &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      // 異步記錄，不阻塞 response
      logTrackingEvent({
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        affiliateCode: affiliateCodeFromUrl,
        eventType: "click",
        request,
        userId: user?.id,
      }).catch((error) => {
        console.error("記錄推薦點擊失敗:", error);
      });
    }
  }
  // ===== 結束追蹤邏輯 =====

  // 暫時停用認證檢查，允許未登入使用者訪問 dashboard
  // TODO: 未來需要重新啟用認證系統
  // if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/login'
  //   return NextResponse.redirect(url)
  // }

  // if (user && request.nextUrl.pathname === '/login') {
  //   const url = request.nextUrl.clone()
  //   url.pathname = '/dashboard'
  //   return NextResponse.redirect(url)
  // }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}
