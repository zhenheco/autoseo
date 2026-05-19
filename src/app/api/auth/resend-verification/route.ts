import { NextRequest, NextResponse } from "next/server";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const bodyResult = await safeJson<{ email?: string }>(request);
    if (!bodyResult.success) {
      return requestErrorResponse(bodyResult.error);
    }

    const { email } = bodyResult.data;

    if (!email) {
      return NextResponse.json(
        { error: "請提供電子郵件地址" },
        { status: 400 },
      );
    }

    // 速率限制：防止濫發驗證信
    const rateLimitResponse = await checkRateLimit(
      `auth_resend:${email.toLowerCase()}`,
      RATE_LIMIT_CONFIGS.AUTH_RESEND,
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com"}/auth/confirm`,
      },
    });

    if (error) {
      console.error("[Resend Verification] Error:", error);
      return NextResponse.json(
        { error: "重發驗證信失敗，請稍後再試" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "驗證信已重新發送，請檢查您的信箱",
    });
  } catch (error) {
    console.error("[Resend Verification] Unexpected error:", error);
    return NextResponse.json({ error: "系統錯誤" }, { status: 500 });
  }
}
