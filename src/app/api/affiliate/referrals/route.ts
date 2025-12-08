import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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

    const adminClient = createAdminClient();

    // 查詢 referrals 和關聯的 companies
    let query = adminClient
      .from("referrals")
      .select(
        `
        *,
        referred_company:companies!referred_company_id (
          name,
          owner_id
        )
      `,
        { count: "exact" },
      )
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

    // 批量獲取用戶 email
    const ownerIds = referrals
      ?.map((r) => (r.referred_company as { owner_id?: string })?.owner_id)
      .filter((id): id is string => !!id);

    let emailMap = new Map<string, string>();
    if (ownerIds && ownerIds.length > 0) {
      const { data: users } = await adminClient.auth.admin.listUsers();
      if (users?.users) {
        const relevantUsers = users.users.filter((u) =>
          ownerIds.includes(u.id),
        );
        emailMap = new Map(relevantUsers.map((u) => [u.id, u.email || ""]));
      }
    }

    const formattedData = referrals?.map((ref) => {
      const company = ref.referred_company as {
        name?: string;
        owner_id?: string;
      } | null;
      const email = company?.owner_id
        ? emailMap.get(company.owner_id)
        : undefined;
      return {
        id: ref.id,
        company_name: email || company?.name || "未知",
        registered_at: ref.registered_at,
        first_payment_at: ref.first_payment_at,
        first_payment_amount: ref.first_payment_amount || null,
        total_payments: ref.total_payments || 0,
        lifetime_value: ref.lifetime_value || 0,
        total_commission_generated: ref.total_commission_generated || 0,
        last_payment_at: ref.last_payment_at || null,
        cancelled_at: null,
        is_active: ref.first_payment_at !== null,
        status: ref.status,
      };
    });

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
