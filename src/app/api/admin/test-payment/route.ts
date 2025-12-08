import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth-guard";
import { PaymentService } from "@/lib/payment/payment-service";

export async function POST() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    if (!isSuperAdmin(user.email)) {
      return NextResponse.json({ error: "無權限" }, { status: 403 });
    }

    // 查詢用戶的公司
    const { data: membership, error: membershipError } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (membershipError) {
      console.error("[Admin Test Payment] 查詢公司失敗:", membershipError);
    }

    if (!membership) {
      return NextResponse.json({ error: "找不到公司" }, { status: 400 });
    }

    // 查詢測試方案
    const { data: testPlan, error: planError } = await supabase
      .from("subscription_plans")
      .select("id, lifetime_price")
      .eq("slug", "test-payment-1nt")
      .single();

    if (planError) {
      console.error("[Admin Test Payment] 查詢方案失敗:", planError);
    }

    if (!testPlan) {
      return NextResponse.json({ error: "找不到測試方案" }, { status: 400 });
    }

    console.log("[Admin Test Payment] 建立訂單:", {
      companyId: membership.company_id,
      planId: testPlan.id,
      amount: testPlan.lifetime_price,
    });

    const paymentService = PaymentService.createInstance(supabase);

    const result = await paymentService.createOnetimePayment({
      companyId: membership.company_id,
      paymentType: "lifetime",
      relatedId: testPlan.id,
      amount: testPlan.lifetime_price || 1,
      description: "藍新金流正式環境測試 NT$1",
      email: user.email || "",
    });

    if (!result.success) {
      console.error("[Admin Test Payment] 建立訂單失敗:", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    console.log("[Admin Test Payment] 訂單建立成功:", result.orderNo);

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      orderNo: result.orderNo,
      paymentForm: result.paymentForm,
    });
  } catch (error) {
    console.error("[Admin Test Payment] 發生錯誤:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "建立測試訂單失敗" },
      { status: 500 },
    );
  }
}
