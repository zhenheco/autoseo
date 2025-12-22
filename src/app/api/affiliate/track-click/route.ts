import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { trackClick } from "@/lib/affiliate-client";

/**
 * POST /api/affiliate/track-click
 *
 * 追蹤推薦連結點擊事件
 * 使用 cookie 防止同一 session 重複追蹤
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const affiliateRef = cookieStore.get("affiliate_ref")?.value;

    // 沒有推薦碼，不追蹤
    if (!affiliateRef) {
      return NextResponse.json({ tracked: false, reason: "no_referral" });
    }

    // 檢查是否已在此 session 追蹤過
    const alreadyTracked = cookieStore.get("affiliate_clicked")?.value;
    if (alreadyTracked === affiliateRef) {
      return NextResponse.json({ tracked: false, reason: "already_tracked" });
    }

    // 取得請求資料
    const body = await request.json().catch(() => ({}));
    const headersList = await headers();

    // 呼叫 Affiliate System 追蹤點擊
    const success = await trackClick({
      referralCode: affiliateRef,
      sessionId: body.sessionId,
      landingUrl: body.landingUrl,
      referrerUrl: headersList.get("referer") || undefined,
      utmSource: body.utmSource,
      utmMedium: body.utmMedium,
      utmCampaign: body.utmCampaign,
    });

    // 設置短期 cookie 防止重複追蹤（1 小時）
    const response = NextResponse.json({ tracked: success });
    response.cookies.set("affiliate_clicked", affiliateRef, {
      path: "/",
      maxAge: 60 * 60, // 1 小時
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[API] Track click error:", error);
    return NextResponse.json(
      { tracked: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
