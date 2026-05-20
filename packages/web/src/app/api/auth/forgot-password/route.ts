import { NextRequest, NextResponse } from "next/server";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import { createClient } from "@shared/supabase";

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

    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com"}/reset-password`,
    });

    if (error) {
      console.error("Reset password error:", error);
      return NextResponse.json(
        { error: "發送重設密碼郵件失敗" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { message: "密碼重設郵件已發送" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Forgot password API error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
