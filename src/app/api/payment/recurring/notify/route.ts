import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";
import { verifyNewebPayCallback } from "@/lib/security/webhook-validator";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    const formData = await request.formData();
    const period = formData.get("Period") as string;
    const tradeSha = formData.get("TradeSha") as string;

    console.log("[API Recurring Notify] 收到定期定額通知:", {
      hasPeriod: !!period,
      hasTradeSha: !!tradeSha,
      timestamp: new Date().toISOString(),
    });

    if (!period) {
      console.error("[API Recurring Notify] 缺少必要參數");
      return new Response(
        "Status=FAILED&Message=" + encodeURIComponent("缺少必要參數"),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }

    const hashKey = process.env.NEWEBPAY_HASH_KEY;
    const hashIV = process.env.NEWEBPAY_HASH_IV;

    if (!hashKey || !hashIV) {
      console.error("[API Recurring Notify] NewebPay 金鑰未設定");
      return new Response(
        "Status=FAILED&Message=" + encodeURIComponent("服務器配置錯誤"),
        {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        },
      );
    }

    if (tradeSha) {
      const isValidSignature = verifyNewebPayCallback(
        period,
        tradeSha,
        hashKey,
        hashIV,
      );

      if (!isValidSignature) {
        console.error("[API Recurring Notify] 簽章驗證失敗，可能是偽造的請求");
        return new Response(
          "Status=FAILED&Message=" + encodeURIComponent("簽章驗證失敗"),
          {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          },
        );
      }

      console.log("[API Recurring Notify] 簽章驗證通過");
    }

    const paymentService = PaymentService.createInstance(supabase);

    const result = await paymentService.handleRecurringCallback(period);

    if (result.success) {
      console.log("[API Recurring Notify] 處理成功，回應 SUCCESS");
      return new Response("Status=SUCCESS", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } else {
      console.error("[API Recurring Notify] 處理失敗:", result.error);
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
    console.error("[API Recurring Notify] 處理定期定額通知失敗:", error);
    console.error(
      "[API Recurring Notify] 錯誤類型:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "[API Recurring Notify] 錯誤訊息:",
      error instanceof Error ? error.message : String(error),
    );

    // 檢測是否為解密錯誤
    const isDecryptError =
      error instanceof Error && error.message.includes("bad decrypt");
    if (isDecryptError) {
      console.error("[API Recurring Notify] 🔴 解密失敗 - 請檢查環境變數");
      console.error("[API Recurring Notify] 建議：");
      console.error("  1. 確認 NEWEBPAY_HASH_KEY 長度為 32 bytes");
      console.error("  2. 確認 NEWEBPAY_HASH_IV 長度為 16 bytes");
      console.error("  3. 確認沒有包含空格或換行符");
      console.error("  4. 確認與藍新金流後台設定一致");
    }

    const errorMessage = isDecryptError
      ? "訂閱處理失敗 - 環境變數配置錯誤"
      : error instanceof Error
        ? error.message
        : "處理定期定額通知失敗";
    return new Response(
      "Status=FAILED&Message=" + encodeURIComponent(errorMessage),
      {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      },
    );
  }
}
