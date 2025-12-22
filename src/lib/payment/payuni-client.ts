/**
 * PAYUNi 金流 SDK 客戶端
 *
 * 用於與金流微服務進行通信，處理單次付款和定期定額付款
 *
 * @example
 * ```typescript
 * import { createPayUniClient } from '@/lib/payment/payuni-client';
 *
 * const client = createPayUniClient({
 *   apiKey: process.env.PAYUNI_API_KEY!,
 *   siteCode: process.env.PAYUNI_SITE_CODE!,
 *   webhookSecret: process.env.PAYUNI_WEBHOOK_SECRET!,
 *   environment: 'production',
 * });
 *
 * // 單次付款
 * const result = await client.createPayment({
 *   orderId: 'order-123',
 *   amount: 100,
 *   email: 'user@example.com',
 *   description: '商品描述',
 * });
 *
 * // 定期定額
 * const subResult = await client.createPeriodPayment({
 *   orderId: 'sub-123',
 *   periodParams: {
 *     periodAmt: 299,
 *     prodDesc: '月費訂閱',
 *     periodType: 'month',
 *     periodDate: '1',
 *     periodTimes: 12,
 *     firstType: 'build',
 *   },
 * });
 * ```
 */

import type {
  PayUniClientConfig,
  PayUniClient,
  CreatePaymentParams,
  CreatePeriodPaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  WebhookEvent,
} from "./payuni-types";

// 重新導出類型供外部使用
export type { PayUniClientConfig } from "./payuni-types";

/** 環境對應的 API URL */
const API_URLS = {
  sandbox: "https://sandbox.affiliate.1wayseo.com",
  production: "https://affiliate.1wayseo.com",
} as const;

/**
 * 建立 PAYUNi SDK 客戶端
 *
 * @param config SDK 設定
 * @returns PayUniClient 實例
 */
export function createPayUniClient(config: PayUniClientConfig): PayUniClient {
  // 確保 environment 有有效值，預設為 production
  const environment =
    config.environment === "sandbox" ? "sandbox" : "production";
  const baseUrl = API_URLS[environment];

  console.log("[PayUniClient] 初始化:", {
    environment,
    baseUrl,
    hasSiteCode: !!config.siteCode,
    hasApiKey: !!config.apiKey,
  });

  /**
   * 發送 API 請求
   */
  async function apiRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${baseUrl}${endpoint}`;

    console.log("[PayUniClient] API 請求:", {
      url,
      method: options.method || "GET",
    });

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
          "X-Site-Code": config.siteCode,
          ...options.headers,
        },
      });

      const data = (await response.json()) as Record<string, unknown>;

      console.log("[PayUniClient] API 回應:", {
        status: response.status,
        success: data.success,
        hasPayuniForm: !!data.payuniForm,
        hasError: !!data.error,
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: (data.code as string) || "UNKNOWN_ERROR",
            message:
              (data.error as string) || (data.message as string) || "未知錯誤",
          },
        } as T;
      }

      // 金流微服務直接返回 payuniForm 和 paymentId 在根層級
      // 無需額外包裝，直接返回
      return data as T;
    } catch (error) {
      console.error("[PayUniClient] API 錯誤:", error);
      // 處理網路錯誤
      return {
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "網路連接失敗",
        },
      } as T;
    }
  }

  /**
   * 計算 HMAC-SHA256 簽名
   */
  async function computeHmac(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", key, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * 時間安全的字串比較（防止 timing attack）
   */
  function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  return {
    /**
     * 取得基礎 URL
     */
    getBaseUrl(): string {
      return baseUrl;
    },

    /**
     * 建立單次付款
     */
    async createPayment(
      params: CreatePaymentParams,
    ): Promise<CreatePaymentResponse> {
      return apiRequest<CreatePaymentResponse>("/api/payment/payuni/create", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 建立續期收款（訂閱）
     */
    async createPeriodPayment(
      params: CreatePeriodPaymentParams,
    ): Promise<CreatePaymentResponse> {
      return apiRequest<CreatePaymentResponse>("/api/payment/payuni/period", {
        method: "POST",
        body: JSON.stringify(params),
      });
    },

    /**
     * 查詢付款狀態
     */
    async getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
      return apiRequest<PaymentStatusResponse>(`/api/payment/${paymentId}`, {
        method: "GET",
      });
    },

    /**
     * 驗證 Webhook 簽名並解析事件
     */
    async verifyWebhook(
      rawBody: string,
      signature: string,
    ): Promise<WebhookEvent | null> {
      try {
        // 計算預期簽名
        const expectedSignature = await computeHmac(
          rawBody,
          config.webhookSecret,
        );

        // 時間安全比較
        if (!timingSafeEqual(signature, expectedSignature)) {
          console.error("Webhook 簽名驗證失敗");
          return null;
        }

        // 解析事件
        const event = JSON.parse(rawBody) as WebhookEvent;
        return event;
      } catch (error) {
        console.error("Webhook 解析失敗:", error);
        return null;
      }
    },
  };
}

/**
 * 前端跳轉輔助函數
 *
 * 將 PAYUNi 表單資料轉換為表單並自動提交
 *
 * @example
 * ```typescript
 * const result = await client.createPayment({...});
 * if (result.success && result.data?.payuniForm) {
 *   submitPayuniForm(result.data.payuniForm);
 * }
 * ```
 */
export function submitPayuniForm(form: {
  action: string;
  method: string;
  fields: Record<string, string>;
}): void {
  console.log("[submitPayuniForm] 準備提交表單:", {
    action: form.action,
    method: form.method,
    fieldsCount: Object.keys(form.fields || {}).length,
    fields: form.fields,
  });

  if (!form.action) {
    console.error("[submitPayuniForm] 錯誤: action 為空");
    alert("付款表單錯誤: action 為空");
    return;
  }

  if (!form.fields || Object.keys(form.fields).length === 0) {
    console.error("[submitPayuniForm] 錯誤: fields 為空");
    alert("付款表單錯誤: fields 為空");
    return;
  }

  const formElement = document.createElement("form");
  formElement.method = form.method || "POST";
  formElement.action = form.action;
  // 確保表單不會被 target 影響
  formElement.target = "_self";

  Object.entries(form.fields).forEach(([name, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    // 確保 value 是字串
    input.value = String(value);
    formElement.appendChild(input);
  });

  console.log("[submitPayuniForm] 表單已建立，準備提交到:", form.action);
  document.body.appendChild(formElement);

  // 使用 setTimeout 確保 DOM 更新完成後再提交
  setTimeout(() => {
    console.log("[submitPayuniForm] 正在提交表單...");
    formElement.submit();
  }, 100);
}
