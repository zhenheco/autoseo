/**
 * Admin 付款測試 API
 *
 * 用於在正式環境測試 PAYUNi 金流整合
 * 僅 super-admin 可使用
 */

import { NextResponse } from "next/server";
import { createPayUniClient } from "@/lib/payment/payuni-client";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth-guard";

/** 請求 body 類型 */
interface TestPaymentRequest {
  type: "onetime" | "recurring";
  amount: number;
  description: string;
  email: string;
  periodParams?: {
    periodType: "week" | "month" | "year";
    periodDate: string;
    periodTimes: number;
  };
}

export async function POST(request: Request) {
  try {
    // 驗證用戶身份
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "請先登入" },
        },
        { status: 401 },
      );
    }

    // 驗證是否為 super-admin
    if (!isSuperAdmin(user.email)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "僅限 Super Admin 使用" },
        },
        { status: 403 },
      );
    }

    // 解析請求
    const body: TestPaymentRequest = await request.json();
    const { type, amount, description, email, periodParams } = body;

    // 驗證金額
    if (!amount || amount < 1) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_AMOUNT", message: "金額必須大於 0" },
        },
        { status: 400 },
      );
    }

    // 建立 PAYUNi 客戶端
    const payuniClient = createPayUniClient({
      apiKey: process.env.PAYUNI_API_KEY || "",
      siteCode: process.env.PAYUNI_SITE_CODE || "",
      webhookSecret: process.env.PAYUNI_WEBHOOK_SECRET || "",
      environment:
        (process.env.PAYUNI_ENVIRONMENT as "sandbox" | "production") ||
        "production",
    });

    // 產生唯一訂單編號
    const orderId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 設定回調 URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://1wayseo.com";
    const callbackUrl = `${appUrl}/payment/result`;

    console.log("[Admin Test Payment] 建立訂單:", {
      type,
      orderId,
      amount,
      email,
      environment: process.env.PAYUNI_ENVIRONMENT,
      baseUrl: payuniClient.getBaseUrl(),
    });

    if (type === "onetime") {
      // 單次付款
      const result = await payuniClient.createPayment({
        orderId,
        amount,
        description,
        email,
        callbackUrl,
        metadata: {
          testPayment: "true",
          createdBy: user.email || "",
        },
      });

      console.log("[Admin Test Payment] 單次付款結果:", {
        success: result.success,
        hasPayuniForm: !!result.payuniForm,
        paymentId: result.paymentId,
        error: result.error,
      });

      return NextResponse.json(result);
    } else {
      // 定期定額
      if (!periodParams) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "MISSING_PERIOD_PARAMS",
              message: "定期定額需要 periodParams",
            },
          },
          { status: 400 },
        );
      }

      const result = await payuniClient.createPeriodPayment({
        orderId,
        periodParams: {
          periodAmt: amount,
          prodDesc: description,
          periodType: periodParams.periodType,
          periodDate: periodParams.periodDate,
          periodTimes: periodParams.periodTimes,
          firstType: "build", // 立即扣款首期
          payerEmail: email,
        },
        callbackUrl,
        metadata: {
          testPayment: "true",
          createdBy: user.email || "",
        },
      });

      console.log("[Admin Test Payment] 定期定額結果:", {
        success: result.success,
        hasPayuniForm: !!result.payuniForm,
        paymentId: result.paymentId,
        error: result.error,
      });

      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("[Admin Test Payment] 發生錯誤:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "內部錯誤",
        },
      },
      { status: 500 },
    );
  }
}
