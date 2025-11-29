import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import {
  generateReferralCode,
  getReferralStats,
  getReferralHistory,
  getMyReferrer,
} from "@/lib/referral-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
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

    const companyId = membership.company_id;

    const [stats, history, myReferrer] = await Promise.all([
      getReferralStats(companyId),
      getReferralHistory(companyId),
      getMyReferrer(companyId),
    ]);

    return NextResponse.json({
      stats,
      history,
      myReferrer,
    });
  } catch (error) {
    console.error("API:referrals GET error:", error);
    return NextResponse.json({ error: "取得推薦資料失敗" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
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

    const referralCode = await generateReferralCode(membership.company_id);

    if (!referralCode) {
      return NextResponse.json({ error: "生成推薦碼失敗" }, { status: 500 });
    }

    return NextResponse.json({
      code: referralCode.code,
      url: `${process.env.NEXT_PUBLIC_APP_URL}/r/${referralCode.code}`,
    });
  } catch (error) {
    console.error("API:referrals POST error:", error);
    return NextResponse.json({ error: "生成推薦碼失敗" }, { status: 500 });
  }
}
