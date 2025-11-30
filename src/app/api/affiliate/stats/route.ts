import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAffiliate, getAffiliateStats } from "@/lib/affiliate-service";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    const { data: companyMember } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyMember) {
      return NextResponse.json({ error: "無法取得公司資訊" }, { status: 400 });
    }

    const affiliate = await getAffiliate(companyMember.company_id);

    if (!affiliate) {
      return NextResponse.json({ error: "您還不是聯盟夥伴" }, { status: 404 });
    }

    const stats = await getAffiliateStats(companyMember.company_id);

    if (!stats) {
      return NextResponse.json({ error: "無法取得統計資料" }, { status: 500 });
    }

    const { data: referralCode } = await supabase
      .from("company_referral_codes")
      .select("referral_code, total_referrals")
      .eq("company_id", companyMember.company_id)
      .single();

    const { data: referrals } = await supabase
      .from("referrals")
      .select("status, first_payment_at")
      .eq("referrer_company_id", companyMember.company_id);

    const totalReferrals = referrals?.length || 0;
    const paidReferrals =
      referrals?.filter(
        (r) => r.status === "completed" || r.status === "rewarded",
      ).length || 0;
    const conversionRate =
      totalReferrals > 0 ? (paidReferrals / totalReferrals) * 100 : 0;

    const lastPaymentDate = referrals
      ?.filter((r) => r.first_payment_at)
      .sort((a, b) => {
        const dateA = a.first_payment_at
          ? new Date(a.first_payment_at).getTime()
          : 0;
        const dateB = b.first_payment_at
          ? new Date(b.first_payment_at).getTime()
          : 0;
        return dateB - dateA;
      })[0]?.first_payment_at;

    return NextResponse.json({
      totalReferrals,
      activeReferrals: paidReferrals,
      pendingCommission: stats.pendingCommission,
      lockedCommission: stats.pendingCommission,
      availableCommission: stats.availableCommission,
      withdrawnCommission: stats.withdrawnCommission,
      lifetimeCommission: stats.lifetimeCommission,
      conversionRate: Math.round(conversionRate * 100) / 100,
      lastPaymentDate: lastPaymentDate || null,
      affiliate_code: referralCode?.referral_code || "",
      status: affiliate.status,
      currentTier: stats.currentTier,
      nextTier: stats.nextTier,
      referralsToNextTier: stats.referralsToNextTier,
      qualifiedReferrals: stats.qualifiedReferrals,
    });
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
