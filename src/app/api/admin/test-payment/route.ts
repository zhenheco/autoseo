import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth-guard";
import { PaymentService } from "@/lib/payment/payment-service";

export async function POST() {
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
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "找不到公司" }, { status: 400 });
  }

  // 查詢測試方案
  const { data: testPlan } = await supabase
    .from("subscription_plans")
    .select("id, lifetime_price")
    .eq("slug", "test-payment-1nt")
    .single();

  if (!testPlan) {
    return NextResponse.json({ error: "找不到測試方案" }, { status: 400 });
  }

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
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    orderId: result.orderId,
    orderNo: result.orderNo,
    paymentForm: result.paymentForm,
  });
}
