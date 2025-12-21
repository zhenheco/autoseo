/**
 * POST /api/payment/result-redirect
 *
 * 處理金流回調的 POST 請求，然後重定向到結果頁面。
 *
 * 流程：
 * 1. 藍新金流 POST 到金流微服務 (/api/payment/callback)
 * 2. 金流微服務處理後重定向到此 API
 * 3. 此 API 將 POST 轉為 GET 重定向到 /payment/result 頁面
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * 處理 POST 請求（金流微服務或藍新回調）
 */
export async function POST(request: NextRequest) {
  console.log("[ResultRedirect] 收到 POST 請求");

  // 1. 嘗試從 URL query params 取得參數
  const searchParams = request.nextUrl.searchParams;

  let paymentId = searchParams.get("paymentId");
  let orderId = searchParams.get("orderId");
  let status = searchParams.get("status");
  let message = searchParams.get("message");

  console.log("[ResultRedirect] URL 參數:", {
    paymentId,
    orderId,
    status,
    message,
  });

  // 2. 如果 URL 沒有參數，嘗試從 body 解析
  if (!paymentId && !orderId) {
    try {
      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        // JSON body
        const body = await request.json();
        paymentId = body.paymentId || paymentId;
        orderId = body.orderId || orderId;
        status = body.status || status;
        message = body.message || message;

        console.log("[ResultRedirect] JSON body 參數:", body);
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        // Form data（藍新金流使用此格式）
        const formData = await request.formData();
        paymentId =
          (formData.get("paymentId") as string) ||
          (formData.get("PaymentId") as string) ||
          paymentId;
        orderId =
          (formData.get("orderId") as string) ||
          (formData.get("OrderId") as string) ||
          orderId;
        status =
          (formData.get("status") as string) ||
          (formData.get("Status") as string) ||
          status;
        message =
          (formData.get("message") as string) ||
          (formData.get("Message") as string) ||
          message;

        console.log("[ResultRedirect] FormData 參數:", {
          paymentId,
          orderId,
          status,
          message,
        });
      }
    } catch (error) {
      console.error("[ResultRedirect] 解析 body 失敗:", error);
    }
  }

  // 3. 建立重定向 URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";
  const redirectUrl = new URL("/payment/result", baseUrl);

  if (paymentId) {
    redirectUrl.searchParams.set("paymentId", paymentId);
  }
  if (orderId) {
    redirectUrl.searchParams.set("orderId", orderId);
  }
  if (status) {
    redirectUrl.searchParams.set("status", status);
  }
  if (message) {
    redirectUrl.searchParams.set("message", message);
  }

  console.log("[ResultRedirect] 重定向到:", redirectUrl.toString());

  // 4. 使用 303 See Other 確保瀏覽器以 GET 訪問頁面
  return NextResponse.redirect(redirectUrl.toString(), { status: 303 });
}

/**
 * 處理 GET 請求（用戶直接訪問或測試）
 */
export async function GET(request: NextRequest) {
  console.log("[ResultRedirect] 收到 GET 請求");

  // 直接轉發參數到結果頁面
  const searchParams = request.nextUrl.searchParams;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";
  const redirectUrl = new URL("/payment/result", baseUrl);

  // 轉發所有參數
  searchParams.forEach((value, key) => {
    redirectUrl.searchParams.set(key, value);
  });

  return NextResponse.redirect(redirectUrl.toString(), { status: 303 });
}
