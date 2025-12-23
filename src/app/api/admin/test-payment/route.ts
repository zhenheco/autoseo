/**
 * Admin 付款測試 API
 *
 * 用於在正式環境測試 PAYUNi 金流整合
 * 僅 super-admin 可使用
 *
 * 環境變數（統一使用 PAYMENT_GATEWAY_* 前綴）：
 * - PAYMENT_GATEWAY_API_KEY: 金流微服務 API Key
 * - PAYMENT_GATEWAY_SITE_CODE: 站點代碼
 * - PAYMENT_GATEWAY_ENV: 環境（production/sandbox）
 */

import { NextResponse } from "next/server";
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

/** PAYUNi API 回應格式 */
interface PayUniAPIResponse {
  success: boolean;
  paymentId?: string;
  payuniForm?: {
    action: string;
    method: string;
    fields: Record<string, string>;
  };
  error?: string;
  message?: string;
}

/**
 * 調用 PAYUNi 金流微服務 API
 *
 * 使用 PAYMENT_GATEWAY_* 環境變數
 */
async function callPayUniAPI(
  endpoint: string,
  params: object,
): Promise<PayUniAPIResponse> {
  const baseUrl =
    process.env.PAYMENT_GATEWAY_ENV === "production"
      ? "https://affiliate.1wayseo.com"
      : "https://sandbox.affiliate.1wayseo.com";

  console.log("[Admin Test Payment] 調用 PAYUNi API:", {
    url: `${baseUrl}${endpoint}`,
    hasApiKey: !!process.env.PAYMENT_GATEWAY_API_KEY,
    hasSiteCode: !!process.env.PAYMENT_GATEWAY_SITE_CODE,
    env: process.env.PAYMENT_GATEWAY_ENV,
  });

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.PAYMENT_GATEWAY_API_KEY || "",
        "X-Site-Code": process.env.PAYMENT_GATEWAY_SITE_CODE || "",
      },
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as PayUniAPIResponse;

    console.log("[Admin Test Payment] PAYUNi API 回應:", {
      status: response.status,
      success: data.success,
      hasPayuniForm: !!data.payuniForm,
      paymentId: data.paymentId,
      error: data.error,
    });

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || "API 呼叫失敗",
      };
    }

    return data;
  } catch (error) {
    console.error("[Admin Test Payment] PAYUNi API 呼叫失敗:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "網路錯誤",
    };
  }
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
      environment: process.env.PAYMENT_GATEWAY_ENV,
    });

    if (type === "onetime") {
      // 單次付款 - 使用 PAYUNi 端點
      const result = await callPayUniAPI("/api/payment/payuni/create", {
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

      // 映射 periodType 到 PAYUNi 格式
      const periodTypeMap: Record<string, string> = {
        week: "W",
        month: "M",
        year: "Y",
      };

      const result = await callPayUniAPI("/api/payment/payuni/period", {
        orderId,
        amount,
        description,
        email,
        callbackUrl,
        periodType: periodTypeMap[periodParams.periodType] || "M",
        periodPoint: periodParams.periodDate,
        periodTimes: periodParams.periodTimes,
        periodStartType: 2, // 授權完成後開始扣款
        metadata: {
          testPayment: "true",
          createdBy: user.email || "",
        },
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
