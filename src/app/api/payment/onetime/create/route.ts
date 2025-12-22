import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";

/**
 * POST /api/payment/onetime/create
 *
 * 建立一次性付款訂單。
 * 現在使用金流微服務 SDK，而非直接串接藍新金流。
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
    const { companyId, paymentType, relatedId, amount, description, email } =
      body;

    if (
      !companyId ||
      !paymentType ||
      !relatedId ||
      !amount ||
      !description ||
      !email
    ) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }

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

    // 透過 Gateway SDK 建立付款
    const result = await paymentService.createOnetimePayment({
      companyId,
      paymentType,
      relatedId,
      amount,
      description,
      email,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      orderNo: result.orderNo,
      paymentId: result.paymentId,
      paymentForm: result.paymentForm,
    });
  } catch (error) {
    console.error("[API] 建立單次支付失敗:", error);
    return NextResponse.json({ error: "建立單次支付失敗" }, { status: 500 });
  }
}
