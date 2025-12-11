import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * 篇數制方案類型
 */
interface ArticlePlan {
  id: string;
  name: string;
  slug: string;
  monthly_price: number;
  yearly_price: number | null;
  articles_per_month: number;
  yearly_bonus_months: number;
}

export async function POST(request: NextRequest) {
  try {
    const authClient = await createClient();

    const {
      data: { user },
    } = await authClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, planId, billingCycle, amount, description, email } =
      body;

    if (!companyId || !planId || !billingCycle || !amount) {
      return NextResponse.json({ error: "缺少必要參數" }, { status: 400 });
    }

    if (billingCycle !== "monthly" && billingCycle !== "yearly") {
      return NextResponse.json(
        { error: "billingCycle 必須為 monthly 或 yearly" },
        { status: 400 },
      );
    }

    // 建立 Supabase 客戶端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createSupabaseClient<Database>(
      supabaseUrl,
      supabaseServiceKey,
    );

    // 驗證方案存在
    const { data: planData, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (planError || !planData) {
      console.error("[API] 找不到方案:", planError);
      return NextResponse.json({ error: "找不到方案" }, { status: 404 });
    }

    // 類型斷言
    const plan = planData as unknown as ArticlePlan;

    // 驗證金額是否正確
    const expectedAmount =
      billingCycle === "yearly" ? plan.yearly_price : plan.monthly_price;

    if (amount !== expectedAmount) {
      console.error("[API] 金額不符:", { amount, expectedAmount });
      return NextResponse.json({ error: "金額不符" }, { status: 400 });
    }

    // 建立 PaymentService
    const paymentService = PaymentService.createInstance(supabase);

    // 根據計費週期設定定期定額參數
    if (billingCycle === "monthly") {
      // 月繳：每月扣款，共 12 期
      const result = await paymentService.createRecurringPayment({
        companyId,
        planId,
        amount,
        description: description || `${plan.name} 月繳訂閱`,
        email,
        periodType: "M",
        periodStartType: 2,
        periodTimes: 12,
      });

      if (!result.success) {
        console.error("[API] 建立月繳定期定額失敗:", result.error);
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      console.log("[API] 月繳定期定額建立成功:", {
        mandateNo: result.mandateNo,
        planId,
        amount,
      });

      return NextResponse.json({
        success: true,
        mandateId: result.mandateId,
        mandateNo: result.mandateNo,
        paymentForm: result.paymentForm,
      });
    } else {
      // 年繳：使用一次性付款（因為藍新金流年繳定期定額較複雜）
      // 年繳會在付款成功後給予 12 個月的訂閱 + 贈送篇數
      const result = await paymentService.createOnetimePayment({
        companyId,
        paymentType: "subscription",
        relatedId: planId,
        amount,
        description: description || `${plan.name} 年繳訂閱`,
        email,
      });

      if (!result.success) {
        console.error("[API] 建立年繳訂閱付款失敗:", result.error);
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 500 },
        );
      }

      // 在訂單中記錄 billingCycle
      if (result.orderId) {
        await supabase
          .from("payment_orders")
          .update({
            metadata: { billingCycle: "yearly" },
          } as unknown as Database["public"]["Tables"]["payment_orders"]["Update"])
          .eq("id", result.orderId);
      }

      console.log("[API] 年繳訂閱付款建立成功:", {
        orderNo: result.orderNo,
        planId,
        amount,
      });

      return NextResponse.json({
        success: true,
        orderId: result.orderId,
        orderNo: result.orderNo,
        paymentForm: result.paymentForm,
      });
    }
  } catch (error) {
    console.error("[API] 建立定期定額支付失敗:", error);
    return NextResponse.json(
      { error: "建立定期定額支付失敗" },
      { status: 500 },
    );
  }
}
