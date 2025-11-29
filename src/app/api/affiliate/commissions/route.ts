import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAffiliate, getAffiliateCommissions } from "@/lib/affiliate-service";
import type { AffiliateCommission } from "@/types/referral.types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const status = searchParams.get("status") || "all";

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

    const allCommissions = await getAffiliateCommissions(
      affiliate.id,
      status !== "all" ? status : undefined,
    );

    const startIndex = (page - 1) * limit;
    const paginatedCommissions = allCommissions.slice(
      startIndex,
      startIndex + limit,
    );

    const { data: referralData } = await supabase
      .from("referrals")
      .select("id, referred_company_id")
      .in(
        "id",
        paginatedCommissions.map((c) => c.referral_id),
      );

    const referralMap = new Map(
      referralData?.map((r) => [r.id, r.referred_company_id]) || [],
    );

    const formattedData = paginatedCommissions.map(
      (comm: AffiliateCommission) => ({
        id: comm.id,
        company_name: `客戶 #${(referralMap.get(comm.referral_id) || comm.referral_id).slice(0, 8)}`,
        order_amount: comm.order_amount,
        order_type: comm.order_type,
        tier_level: comm.tier_level,
        commission_rate: comm.commission_rate,
        commission_amount: comm.commission_amount,
        tax_rate: comm.tax_rate,
        tax_amount: comm.tax_amount,
        net_commission: comm.net_commission,
        earned_at: comm.earned_at,
        unlock_at: comm.unlock_at,
        status: comm.status,
        withdrawn_at: comm.withdrawn_at,
      }),
    );

    const summary = {
      total_locked: 0,
      total_available: 0,
      total_withdrawn: 0,
    };

    allCommissions.forEach((comm: AffiliateCommission) => {
      const amount = comm.net_commission;
      if (comm.status === "locked") {
        summary.total_locked += amount;
      } else if (comm.status === "available") {
        summary.total_available += amount;
      } else if (comm.status === "withdrawn") {
        summary.total_withdrawn += amount;
      }
    });

    return NextResponse.json({
      data: formattedData,
      summary,
      pagination: {
        total: allCommissions.length,
        page,
        limit,
        totalPages: Math.ceil(allCommissions.length / limit),
      },
    });
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
