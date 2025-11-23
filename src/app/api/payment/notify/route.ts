import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";
import { verifyNewebPayCallback } from "@/lib/security/webhook-validator";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    const formData = await request.formData();
    const tradeInfo = formData.get("TradeInfo") as string;
    const tradeSha = formData.get("TradeSha") as string;
    const period = formData.get("Period") as string;

    console.log("[API Notify] 收到付款通知:", {
      hasTradeInfo: !!tradeInfo,
      hasTradeSha: !!tradeSha,
      hasPeriod: !!period,
      isRecurring: !!period,
      timestamp: new Date().toISOString(),
    });

    const paymentService = PaymentService.createInstance(supabase);

    if (period) {
      console.log("[API Notify] 處理定期定額付款");
      const result = await paymentService.handleRecurringCallback(period);

      if (result.success) {
        console.log("[API Notify] 定期定額處理成功，回應 SUCCESS");
        return new Response("Status=SUCCESS", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      } else {
        console.error("[API Notify] 定期定額處理失敗:", result.error);
        return new Response(
          "Status=FAILED&Message=" +
            encodeURIComponent(result.error || "處理失敗"),
          {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        );
      }
    }

    if (!tradeInfo || !tradeSha) {
      console.error("[API Notify] 缺少必要參數（單次付款）");
      return new Response(
        "Status=FAILED&Message=" + encodeURIComponent("缺少必要參數"),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }

    // 驗證簽章
    const hashKey = process.env.NEWEBPAY_HASH_KEY;
    const hashIV = process.env.NEWEBPAY_HASH_IV;

    if (!hashKey || !hashIV) {
      console.error("[API Notify] NewebPay 金鑰未設定");
      return new Response(
        "Status=FAILED&Message=" + encodeURIComponent("服務器配置錯誤"),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }

    const isValidSignature = verifyNewebPayCallback(
      tradeInfo,
      tradeSha,
      hashKey,
      hashIV,
    );

    if (!isValidSignature) {
      console.error("[API Notify] 簽章驗證失敗，可能是偽造的請求");
      return new Response(
        "Status=FAILED&Message=" + encodeURIComponent("簽章驗證失敗"),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }

    console.log("[API Notify] 簽章驗證通過，處理單次付款");
    const result = await paymentService.handleOnetimeCallback(
      tradeInfo,
      tradeSha,
    );

    if (result.success) {
      console.log("[API Notify] 單次付款處理成功，回應 SUCCESS");
      return new Response("Status=SUCCESS", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } else {
      console.error("[API Notify] 單次付款處理失敗:", result.error);
      return new Response(
        "Status=FAILED&Message=" +
          encodeURIComponent(result.error || "處理失敗"),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }
  } catch (error) {
    console.error("[API Notify] 處理支付通知失敗:", error);
    const errorMessage =
      error instanceof Error ? error.message : "處理支付通知失敗";
    return new Response(
      "Status=FAILED&Message=" + encodeURIComponent(errorMessage),
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}
