import { NextRequest, NextResponse } from "next/server";
import { validateReferralCode } from "@/lib/referral-service";
import {
  checkRateLimit,
  getClientIP,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting 檢查（使用 IP，因為此端點公開）
    const clientIP = getClientIP(request);
    const rateLimitResponse = await checkRateLimit(
      `referral-validate:${clientIP}`,
      RATE_LIMIT_CONFIGS.REFERRAL_VALIDATE,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "請提供推薦碼" },
        { status: 400 },
      );
    }

    const result = await validateReferralCode(code);

    return NextResponse.json({ valid: result.valid });
  } catch (error) {
    console.error("API:referrals/validate GET error:", error);
    return NextResponse.json(
      { valid: false, error: "驗證失敗" },
      { status: 500 },
    );
  }
}
