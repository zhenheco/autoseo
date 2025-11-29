import { NextRequest, NextResponse } from "next/server";
import { validateReferralCode } from "@/lib/referral-service";

export async function GET(request: NextRequest) {
  try {
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
