import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { setReferralCode } from "@/lib/referral-service";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const body = await request.json();
    const { referralCode } = body;

    if (!referralCode || typeof referralCode !== "string") {
      return NextResponse.json({ error: "請提供推薦碼" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "找不到公司" }, { status: 404 });
    }

    const result = await setReferralCode(membership.company_id, referralCode);

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        invalid_code: "無效的推薦碼",
        self_referral: "不能使用自己的推薦碼",
        already_referred: "您已經綁定了推薦人",
        already_paid: "首次付款後無法再綁定推薦碼",
        creation_failed: "綁定失敗，請稍後再試",
      };

      return NextResponse.json(
        {
          error: errorMessages[result.error || "creation_failed"] || "綁定失敗",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, message: "推薦碼綁定成功" });
  } catch (error) {
    console.error("API:referrals/set-referrer POST error:", error);
    return NextResponse.json({ error: "綁定推薦碼失敗" }, { status: 500 });
  }
}
