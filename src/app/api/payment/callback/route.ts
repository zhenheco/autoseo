import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";
import { verifyNewebPayCallback } from "@/lib/security/webhook-validator";

export async function POST(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    const formData = await request.formData();
    const status = formData.get("Status") as string;
    const tradeInfo = formData.get("TradeInfo") as string;
    const tradeSha = formData.get("TradeSha") as string;

    console.log("[API Callback] 收到 ReturnURL 回調:", {
      hasStatus: !!status,
      hasTradeInfo: !!tradeInfo,
      hasTradeSha: !!tradeSha,
      timestamp: new Date().toISOString(),
    });

    if (!tradeInfo || !tradeSha) {
      console.error("[API Callback] 缺少必要參數");
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent("缺少必要參數")}`;
      const safeRedirectUrl = redirectUrl.replace(/["'<>]/g, "");
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${safeRedirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    const hashKey = process.env.NEWEBPAY_HASH_KEY;
    const hashIV = process.env.NEWEBPAY_HASH_IV;

    if (!hashKey || !hashIV) {
      console.error("[API Callback] NewebPay 金鑰未設定");
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error&error=${encodeURIComponent("服務器配置錯誤")}`;
      const safeRedirectUrl = redirectUrl.replace(/["'<>]/g, "");
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${safeRedirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
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
      console.error("[API Callback] 簽章驗證失敗，可能是偽造的請求");
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent("簽章驗證失敗")}`;
      const safeRedirectUrl = redirectUrl.replace(/["'<>]/g, "");
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${safeRedirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    console.log("[API Callback] 簽章驗證通過");
    const paymentService = PaymentService.createInstance(supabase);

    const result = await paymentService.handleOnetimeCallback(
      tradeInfo,
      tradeSha,
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    let redirectUrl: string;

    if (result.success) {
      console.log("[API Callback] 付款處理成功");
      redirectUrl = `${baseUrl}/dashboard/subscription?payment=success`;
    } else {
      console.error("[API Callback] 付款處理失敗:", result.error);
      redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent(result.error || "支付失敗")}`;
    }

    const safeRedirectUrl = redirectUrl.replace(/["'<>]/g, "");

    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${safeRedirectUrl}";
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  } catch (error) {
    console.error("[API Callback] 處理支付回調失敗:", error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error`;
    const safeRedirectUrl = redirectUrl.replace(/["'<>]/g, "");
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${safeRedirectUrl}";
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }
}
