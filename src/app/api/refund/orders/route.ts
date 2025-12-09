import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RefundService } from "@/lib/payment/refund-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/refund/orders
 * 取得用戶可退款的訂單列表
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // 驗證用戶登入
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "請先登入" },
        { status: 401 },
      );
    }

    // 取得用戶的公司
    const { data: member } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!member) {
      return NextResponse.json(
        { success: false, error: "找不到公司資訊" },
        { status: 404 },
      );
    }

    // 取得可退款訂單
    const refundService = RefundService.createInstance();
    const orders = await refundService.getRefundableOrders(member.company_id);

    // 轉換訂單格式供前端使用
    const formattedOrders = orders.map((order) => {
      // 計算購買天數
      const paidAtDate = order.paid_at
        ? new Date(order.paid_at)
        : new Date(order.created_at);
      const daysSincePurchase = Math.floor(
        (Date.now() - paidAtDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      // 判斷是否符合自動退款（7 天內）
      const isAutoEligible = daysSincePurchase <= 7;

      // 支付類型文字
      const paymentTypeTextMap: Record<string, string> = {
        token_package: "Token 加值包",
        subscription: "訂閱方案",
        lifetime: "終身方案",
      };
      const paymentTypeText =
        paymentTypeTextMap[order.payment_type] || order.payment_type;

      return {
        id: order.id,
        orderNo: order.order_no,
        paymentType: order.payment_type,
        paymentTypeText,
        amount: order.amount,
        tradeNo: order.newebpay_trade_no || "",
        description: order.item_description,
        paidAt: order.paid_at,
        createdAt: order.created_at,
        daysSincePurchase,
        isAutoEligible,
        creditsToDeduct: order.amount,
      };
    });

    return NextResponse.json({
      success: true,
      orders: formattedOrders,
    });
  } catch (error) {
    console.error("[API] /refund/orders error:", error);
    return NextResponse.json(
      { success: false, error: "取得訂單列表失敗" },
      { status: 500 },
    );
  }
}
