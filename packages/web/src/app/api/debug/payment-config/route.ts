/**
 * 診斷用 API：檢查付款相關環境變數
 *
 * 注意：這個 API 只應該在測試環境使用，上線前應該刪除
 */

import { NextResponse } from "next/server";

export async function GET() {
  // 只在非 production 環境允許存取
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production" },
      { status: 403 },
    );
  }

  const config = {
    // 環境變數狀態（不顯示實際值，只顯示是否設定）
    PAYMENT_GATEWAY_API_KEY: process.env.PAYMENT_GATEWAY_API_KEY
      ? `已設定 (${process.env.PAYMENT_GATEWAY_API_KEY.slice(0, 8)}...)`
      : "未設定",
    PAYMENT_GATEWAY_SITE_CODE:
      process.env.PAYMENT_GATEWAY_SITE_CODE || "未設定",
    PAYMENT_GATEWAY_WEBHOOK_SECRET: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET
      ? "已設定"
      : "未設定",
    PAYMENT_GATEWAY_ENV: process.env.PAYMENT_GATEWAY_ENV || "未設定",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "未設定",

    // 計算出的 Gateway URL
    gatewayUrl:
      process.env.PAYMENT_GATEWAY_ENV === "production"
        ? "https://affiliate.1wayseo.com"
        : "https://sandbox.affiliate.1wayseo.com",

    // Node 環境
    NODE_ENV: process.env.NODE_ENV,
  };

  return NextResponse.json({
    message: "付款配置診斷資訊",
    config,
    timestamp: new Date().toISOString(),
  });
}
