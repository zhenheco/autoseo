/**
 * POST /api/payment/gateway-webhook
 *
 * 接收金流微服務的付款結果 Webhook 通知。
 *
 * 這個 API 取代了原本的 /api/payment/notify，不同之處：
 * - 接收 JSON 格式（而非藍新的加密 FormData）
 * - 使用 HMAC-SHA256 簽名驗證（而非藍新的 TradeSha）
 * - 資料已經被金流微服務解密過
 *
 * Headers:
 * - X-Webhook-Signature: HMAC-SHA256 簽名
 *
 * Body (JSON):
 * - paymentId: 付款 ID
 * - orderId: 訂單 ID
 * - status: 付款狀態 (SUCCESS | FAILED | CANCELLED | REFUNDED)
 * - amount: 金額
 * - paidAt: 付款時間 (ISO 8601)
 * - newebpayTradeNo: 藍新交易序號
 * - metadata: 額外資料
 * - errorMessage: 錯誤訊息（當 status 為 FAILED 時）
 */

import { NextRequest, NextResponse } from "next/server";
import { handleGatewayWebhook } from "@/lib/payment/webhook-handler";

export async function POST(request: NextRequest) {
  console.log("[API GatewayWebhook] 收到請求");

  try {
    // 取得原始 body 和簽名
    const rawBody = await request.text();
    const signature = request.headers.get("X-Webhook-Signature");

    console.log("[API GatewayWebhook] 請求資訊:", {
      hasBody: !!rawBody,
      hasSignature: !!signature,
      bodyLength: rawBody.length,
    });

    // 處理 Webhook
    const result = await handleGatewayWebhook(rawBody, signature);

    if (result.received) {
      console.log("[API GatewayWebhook] 處理成功:", {
        paymentId: result.paymentId,
        orderId: result.orderId,
      });

      return NextResponse.json({ received: true }, { status: 200 });
    } else {
      console.error("[API GatewayWebhook] 處理失敗:", result.error);

      return NextResponse.json({ error: result.error }, { status: 401 });
    }
  } catch (error) {
    console.error("[API GatewayWebhook] 未預期錯誤:", error);

    return NextResponse.json({ error: "內部錯誤" }, { status: 500 });
  }
}
