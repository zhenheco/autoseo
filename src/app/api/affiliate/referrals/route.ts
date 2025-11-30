import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAffiliate } from "@/lib/affiliate-service";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    let query = supabase
      .from("referrals")
      .select("*", { count: "exact" })
      .eq("referrer_company_id", companyMember.company_id);

    if (status === "active") {
      query = query.not("first_payment_at", "is", null);
    } else if (status === "inactive") {
      query = query.is("first_payment_at", null);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const {
      data: referrals,
      error,
      count,
    } = await query.order("created_at", { ascending: false }).range(from, to);

    if (error) {
      console.error("查詢推薦列表失敗:", error);
      return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }

    const formattedData = referrals?.map((ref) => ({
      id: ref.id,
      company_name: `客戶 #${ref.referred_company_id.slice(0, 8)}`,
      registered_at: ref.referred_at,
      first_payment_at: ref.first_payment_at,
      is_active: ref.first_payment_at !== null,
      status: ref.status,
    }));

    return NextResponse.json({
      data: formattedData,
      referrals: formattedData,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
