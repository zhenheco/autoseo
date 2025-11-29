import { NextRequest, NextResponse } from "next/server";
import {
  validateReferralCode,
  recordReferralClick,
} from "@/lib/referral-service";

const REFERRAL_COOKIE_NAME = "ref_code";
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  if (!code || code.length < 4) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const validation = await validateReferralCode(code);

  if (!validation.valid) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const sessionId = crypto.randomUUID();
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0] ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || undefined;
  const referer = request.headers.get("referer") || undefined;

  await recordReferralClick(code, {
    sessionId,
    ipAddress,
    userAgent,
    referer,
    landingPage: request.url,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://seo.zhenhe-dm.com";
  const redirectUrl = new URL("/zh/login", baseUrl);
  redirectUrl.searchParams.set("ref", code.toUpperCase());

  const response = NextResponse.redirect(redirectUrl);

  response.cookies.set(REFERRAL_COOKIE_NAME, code.toUpperCase(), {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return response;
}
