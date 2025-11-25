import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "請提供電子郵件地址" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://seo.zhenhe-dm.com"}/auth/confirm`,
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
