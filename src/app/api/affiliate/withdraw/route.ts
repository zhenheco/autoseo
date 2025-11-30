import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAffiliate } from "@/lib/affiliate-service";
import { MIN_WITHDRAWAL_AMOUNT } from "@/types/referral.types";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "請先登入" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { amount, bank_code, bank_branch, bank_account, bank_account_name } =
      body;

    if (!amount || !bank_code || !bank_account || !bank_account_name) {
      return NextResponse.json(
        { success: false, message: "請填寫所有必填欄位" },
        { status: 400 },
      );
    }

    if (amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        {
          success: false,
          message: `最低提領金額為 NT$${MIN_WITHDRAWAL_AMOUNT}`,
        },
        { status: 400 },
      );
    }

    const { data: companyMember } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!companyMember) {
      return NextResponse.json(
        { success: false, message: "無法取得公司資訊" },
        { status: 400 },
      );
    }

    const affiliate = await getAffiliate(companyMember.company_id);

    if (!affiliate) {
      return NextResponse.json(
        { success: false, message: "您還不是聯盟夥伴" },
        { status: 404 },
      );
    }

    const availableCommission = affiliate.available_commission ?? 0;

    if (amount > availableCommission) {
      return NextResponse.json(
        {
          success: false,
          message: `可提領金額不足。您的可提領餘額為 NT$${availableCommission.toFixed(2)}`,
        },
        { status: 400 },
      );
    }

    const taxRate = affiliate.tax_rate ?? 10;
    const taxAmount = amount * (taxRate / 100);
    const netAmount = amount - taxAmount;

    const requiresDocuments = !affiliate.bank_code || !affiliate.bank_account;

    const { data: availableCommissions } = await supabase
      .from("affiliate_commissions")
      .select("id, net_commission")
      .eq("affiliate_id", affiliate.id)
      .eq("status", "available")
      .order("unlock_at", { ascending: true });

    let remainingAmount = amount;
    const commissionIds: string[] = [];

    for (const comm of availableCommissions || []) {
      if (remainingAmount <= 0) break;

      const commAmount = comm.net_commission;
      if (commAmount <= remainingAmount) {
        commissionIds.push(comm.id);
        remainingAmount -= commAmount;
      }
    }

    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("affiliate_withdrawals")
      .insert({
        affiliate_id: affiliate.id,
        withdrawal_amount: amount,
        tax_amount: taxAmount,
        net_amount: netAmount,
        bank_code,
        bank_branch: bank_branch || null,
        bank_account,
        bank_account_name,
        status: "pending",
        commission_ids: commissionIds,
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error("創建提領申請失敗:", withdrawalError);
      return NextResponse.json(
        { success: false, message: "提領申請失敗，請稍後再試" },
        { status: 500 },
      );
    }

    if (commissionIds.length > 0) {
      await supabase
        .from("affiliate_commissions")
        .update({
          status: "withdrawn",
          withdrawal_id: withdrawal.id,
          withdrawn_at: new Date().toISOString(),
        })
        .in("id", commissionIds);

      await supabase
        .from("affiliates")
        .update({
          available_commission: availableCommission - amount,
          withdrawn_commission:
            (affiliate.withdrawn_commission ?? 0) + netAmount,
        })
        .eq("id", affiliate.id);
    }

    return NextResponse.json({
      success: true,
      withdrawal_id: withdrawal.id,
      message: requiresDocuments
        ? "提領申請已提交。請確認銀行帳戶資訊正確，將於每月 25 號統一撥款。"
        : "提領申請已提交，將於每月 25 號統一撥款。",
      requires_documents: requiresDocuments,
    });
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json(
      { success: false, message: "伺服器錯誤" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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

    const { data: withdrawals, error } = await supabase
      .from("affiliate_withdrawals")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("查詢提領記錄失敗:", error);
      return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
    }

    const formattedData = withdrawals?.map((w) => ({
      id: w.id,
      withdrawal_amount: w.withdrawal_amount,
      tax_amount: w.tax_amount,
      net_amount: w.net_amount,
      status: w.status,
      created_at: w.created_at,
      processed_at: w.processed_at,
      completed_at: w.completed_at,
    }));

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error("API 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
