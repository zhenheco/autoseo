import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";

/**
 * POST /api/payment/recurring/create
 *
 * 建立定期定額訂閱付款。
 * 使用金流微服務 SDK 處理 PAYUNi 定期定額。
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, planId, billingCycle, amount, description, email } =
      body;

    if (!companyId || !planId || !amount || !description || !email) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }

    // 驗證公司成員權限
    const { data: membership } = await supabase
      .from("company_members")
      .select("role")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "無權限存取此公司" }, { status: 403 });
    }

    const paymentService = PaymentService.createInstance(supabase);

    // 呼叫 PaymentService 建立定期定額付款
    const result = await paymentService.createRecurringPayment({
      companyId,
      planId,
      amount,
      description,
      email,
      periodType: "M",
      periodStartType: 2,
      periodTimes: 12,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      mandateId: result.mandateId,
      mandateNo: result.mandateNo,
      paymentId: result.paymentId,
      paymentForm: result.paymentForm,
    });
  } catch (error) {
    console.error("[API] 建立定期定額失敗:", error);
    return NextResponse.json({ error: "建立定期定額失敗" }, { status: 500 });
  }
}
