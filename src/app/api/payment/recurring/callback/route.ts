import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { PaymentService } from "@/lib/payment/payment-service";
import { calculateAndCreateCommission } from "@/lib/affiliate/commission";
import { verifyNewebPayCallback } from "@/lib/security/webhook-validator";

// 處理 GET 請求（藍新金流使用 GET 重定向）
export async function GET(request: NextRequest) {
  return handleCallback(request);
}

// 處理 POST 請求（以防萬一藍新金流改用 POST）
export async function POST(request: NextRequest) {
  return handleCallback(request);
}

async function handleCallback(request: NextRequest) {
  try {
    console.log("=".repeat(80));
    console.log("[Payment Callback] 收到回調請求 - Method:", request.method);
    console.log("[Payment Callback] URL:", request.url);
    console.log(
      "[Payment Callback] Headers:",
      Object.fromEntries(request.headers.entries()),
    );

    const params: Record<string, string> = {};
    let tradeInfo: string | null = null;
    let tradeSha: string | null = null;
    let period: string | null = null;
    let status: string | null = null;
    let message: string | null = null;

    if (request.method === "GET") {
      const searchParams = request.nextUrl.searchParams;
      searchParams.forEach((value, key) => {
        params[key] = value;
      });
      tradeInfo =
        searchParams.get("TradeInfo") || searchParams.get("tradeInfo");
      tradeSha = searchParams.get("TradeSha") || searchParams.get("tradeSha");
      period = searchParams.get("Period") || searchParams.get("period");
      status = searchParams.get("Status") || searchParams.get("status");
      message = searchParams.get("Message") || searchParams.get("message");
    } else {
      const formData = await request.formData();
      formData.forEach((value, key) => {
        params[key] = value.toString();
      });
      tradeInfo =
        (formData.get("TradeInfo") as string) ||
        (formData.get("tradeInfo") as string);
      tradeSha =
        (formData.get("TradeSha") as string) ||
        (formData.get("tradeSha") as string);
      period =
        (formData.get("Period") as string) ||
        (formData.get("period") as string);
      status =
        (formData.get("Status") as string) ||
        (formData.get("status") as string);
      message =
        (formData.get("Message") as string) ||
        (formData.get("message") as string);
    }

    console.log("[Payment Callback] 解析結果:", {
      hasTradeInfo: !!tradeInfo,
      hasTradeSha: !!tradeSha,
      hasPeriod: !!period,
      status,
      message,
      allParams: Object.keys(params),
      fullParams: params, // 記錄所有參數的完整內容
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // 定期定額授權使用 Period 參數，一般付款使用 TradeInfo/TradeSha
    const isPeriodCallback = !!period;
    const isTradeCallback = !!tradeInfo && !!tradeSha;

    // 只在一般付款時檢查 Status，定期定額授權不檢查（因為 ReturnURL 可能不帶 Status）
    if (!isPeriodCallback && status && status !== "SUCCESS" && status !== "1") {
      console.error(
        "[Payment Callback] 付款失敗，狀態:",
        status,
        "訊息:",
        message,
      );
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent(message || "付款失敗")}`;
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (!isPeriodCallback && !isTradeCallback) {
      console.error("[Payment Callback] 缺少必要參數");
      const redirectUrl =
        Object.keys(params).length === 0
          ? `${baseUrl}/dashboard/subscription`
          : `${baseUrl}/dashboard/subscription?payment=error`;
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
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
      console.error("[Payment Callback] NewebPay 金鑰未設定");
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error&error=${encodeURIComponent("服務器配置錯誤")}`;
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }

    if (isTradeCallback && tradeSha) {
      const isValidSignature = verifyNewebPayCallback(
        tradeInfo!,
        tradeSha,
        hashKey,
        hashIV,
      );

      if (!isValidSignature) {
        console.error("[Payment Callback] 簽章驗證失敗，可能是偽造的請求");
        const redirectUrl = `${baseUrl}/dashboard/subscription?payment=failed&error=${encodeURIComponent("簽章驗證失敗")}`;
        return new NextResponse(
          `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
          {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      }

      console.log("[Payment Callback] 簽章驗證通過");
    }

    // 解密獲取 orderNo（使用 Service Role Key 以繞過 RLS）
    const supabase = createAdminClient();
    const paymentService = PaymentService.createInstance(supabase);

    try {
      let orderNo: string;
      let decryptedData: Record<string, unknown>;

      if (isPeriodCallback) {
        // 定期定額授權回調
        console.log("[Payment Callback] 處理定期定額授權回調");
        decryptedData = paymentService.decryptPeriodCallback(period!);

        // 記錄完整解密資料（診斷用）
        console.log(
          "[Payment Callback] 定期定額解密資料:",
          JSON.stringify(decryptedData, null, 2),
        );

        // Period 回調的結構: { Status, Message, Result: { MerchantOrderNo, ... } }
        const result = (decryptedData as any).Result;
        if (result && result.MerchantOrderNo) {
          orderNo = result.MerchantOrderNo as string;
        } else {
          // 向後兼容：嘗試其他可能的欄位名稱
          orderNo = (decryptedData.MerOrderNo ||
            decryptedData.PeriodNo ||
            decryptedData.MandateNo) as string;
        }

        if (!orderNo) {
          console.error("[Payment Callback] 無法從解密資料取得 orderNo");
          console.error(
            "[Payment Callback] decryptedData 結構:",
            JSON.stringify(decryptedData, null, 2),
          );
          throw new Error("無法取得訂單編號");
        }
      } else {
        // 一般付款回調
        console.log("[Payment Callback] 處理一般付款回調");
        decryptedData = paymentService.decryptTradeInfoForRecurring(
          tradeInfo!,
          tradeSha!,
        );
        orderNo = (decryptedData.MerOrderNo ||
          decryptedData.MerchantOrderNo) as string;
      }

      console.log("[Payment Callback] 解密成功，orderNo:", orderNo);

      // 對於定期定額授權，直接處理授權成功（NotifyURL 只在定期扣款時調用）
      if (isPeriodCallback) {
        console.log("[Payment Callback] 直接處理定期定額授權成功");

        const result = (decryptedData as any).Result;
        const status = (decryptedData as any).Status as string;

        if (status === "SUCCESS" && result) {
          // 提取關鍵資訊
          const periodNo = result.PeriodNo as string;
          const tradeNo = result.TradeNo as string;
          const authCode = result.AuthCode as string;

          console.log("[Payment Callback] 授權資訊:", {
            periodNo,
            tradeNo,
            authCode,
            orderNo,
          });

          try {
            // 調用 payment-service 處理完整的授權成功邏輯
            // 這會更新 mandate、order、建立 subscription 和添加代幣
            const handleResult = await paymentService.handleRecurringCallback(
              period!,
            );

            if (!handleResult.success) {
              console.error(
                "[Payment Callback] 處理授權失敗:",
                handleResult.error,
              );
              throw new Error(handleResult.error || "處理授權失敗");
            }

            console.log(
              "[Payment Callback] 授權成功，所有資料已更新（包含訂閱和代幣）",
            );

            // 計算並創建佣金（異步執行，不阻塞返回）
            try {
              // 查詢訂單資訊
              const { data: paymentOrder } = await supabase
                .from("payment_orders")
                .select(
                  "id, company_id, order_type, payment_type, amount, paid_at",
                )
                .eq("order_no", orderNo)
                .single();

              if (
                paymentOrder &&
                paymentOrder.payment_type === "subscription"
              ) {
                console.log("[Affiliate] 開始計算佣金，訂單:", paymentOrder.id);

                const commissionResult = await calculateAndCreateCommission({
                  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
                  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
                  paymentOrder: paymentOrder as {
                    id: string;
                    company_id: string;
                    order_type: string;
                    payment_type: "subscription" | "token_package" | "lifetime";
                    amount: number;
                    paid_at: string;
                  },
                });

                if (commissionResult.success) {
                  console.log(
                    "[Affiliate] 佣金創建成功:",
                    commissionResult.commission_id,
                  );
                } else {
                  console.log(
                    "[Affiliate] 佣金創建失敗或無需創建:",
                    commissionResult.message,
                  );
                }
              }
            } catch (commissionError) {
              // 佣金計算失敗不影響支付流程
              console.error("[Affiliate] 佣金計算錯誤:", commissionError);
            }

            // 立即返回成功，使用 mandateNo 參數
            const redirectUrl = `${baseUrl}/dashboard/subscription?payment=success&mandateNo=${encodeURIComponent(orderNo)}`;
            return new NextResponse(
              `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>授權成功</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
              {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              },
            );
          } catch (error) {
            console.error("[Payment Callback] 處理授權成功失敗:", error);
            const errorMessage =
              error instanceof Error ? error.message : "處理授權失敗";
            const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error&error=${encodeURIComponent(errorMessage)}`;
            return new NextResponse(
              `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理失敗</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
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
      }

      // 返回 pending 狀態，前端會輪詢訂單狀態（使用 mandateNo）
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=pending&mandateNo=${encodeURIComponent(orderNo)}`;

      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    } catch (error) {
      console.error("[Payment Callback] 解密失敗:", error);
      const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error`;
      return new NextResponse(
        `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        },
      );
    }
  } catch (error) {
    console.error("=".repeat(80));
    console.error("[Payment Callback] 處理回調失敗 - 最外層 catch");
    console.error(
      "[Payment Callback] 錯誤類型:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "[Payment Callback] 錯誤訊息:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "[Payment Callback] 錯誤堆疊:",
      error instanceof Error ? error.stack : "無堆疊資訊",
    );

    // 檢測是否為解密錯誤
    const isDecryptError =
      error instanceof Error && error.message.includes("bad decrypt");
    if (isDecryptError) {
      console.error("[Payment Callback] 🔴 解密失敗 - 請檢查環境變數");
      console.error("[Payment Callback] 建議：");
      console.error("  1. 確認 NEWEBPAY_HASH_KEY 長度為 32 bytes");
      console.error("  2. 確認 NEWEBPAY_HASH_IV 長度為 16 bytes");
      console.error("  3. 確認沒有包含空格或換行符");
      console.error("  4. 確認與藍新金流後台設定一致");
    }

    console.error("=".repeat(80));
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const errorMessage = isDecryptError
      ? "訂閱處理失敗，請稍後再試或聯繫客服"
      : "處理失敗，請重新整理頁面";
    const redirectUrl = `${baseUrl}/dashboard/subscription?payment=error&error=${encodeURIComponent(errorMessage)}`;
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>處理中...</title>
</head>
<body>
  <script>
    window.location.href = "${redirectUrl}";
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
