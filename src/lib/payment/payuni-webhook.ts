/**
 * PAYUNi Webhook 處理器
 *
 * 負責驗證和解析來自金流微服務的 Webhook 事件
 *
 * 環境變數（統一使用 PAYMENT_GATEWAY_* 前綴）：
 * - PAYMENT_GATEWAY_WEBHOOK_SECRET: Webhook 驗證密鑰
 *
 * @example
 * ```typescript
 * import { PayUniWebhookHandler } from '@/lib/payment/payuni-webhook';
 *
 * const handler = new PayUniWebhookHandler({
 *   webhookSecret: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET!,
 * });
 *
 * // 在 API route 中使用
 * export async function POST(request: Request) {
 *   const rawBody = await request.text();
 *   const signature = request.headers.get('x-webhook-signature') || '';
 *
 *   const result = await handler.handleWebhook(rawBody, signature);
 *
 *   if (!result.success) {
 *     return new Response(result.error, { status: 401 });
 *   }
 *
 *   // 處理事件
 *   switch (result.event?.type) {
 *     case 'payment.success':
 *       await handlePaymentSuccess(result.event.data);
 *       break;
 *     // ...
 *   }
 *
 *   return new Response('OK');
 * }
 * ```
 */

import type { WebhookEvent, WebhookEventType } from "./payuni-types";

/** Webhook 處理器配置 */
export interface WebhookHandlerConfig {
  /** Webhook 簽名密鑰 */
  webhookSecret: string;
}

/** Webhook 處理結果 */
export interface WebhookHandlerResult {
  /** 是否成功 */
  success: boolean;
  /** 解析後的事件（成功時） */
  event?: WebhookEvent;
  /** 錯誤代碼（失敗時） */
  error?:
    | "MISSING_SIGNATURE"
    | "INVALID_SIGNATURE"
    | "INVALID_JSON"
    | "INVALID_EVENT_FORMAT"
    | "UNKNOWN_EVENT_TYPE";
}

/** 有效的事件類型列表 */
const VALID_EVENT_TYPES: WebhookEventType[] = [
  "payment.success",
  "payment.failed",
  "period.authorized",
  "period.deducted",
  "period.failed",
];

/**
 * PAYUNi Webhook 處理器
 *
 * 提供 Webhook 簽名驗證和事件解析功能
 */
export class PayUniWebhookHandler {
  private readonly webhookSecret: string;

  constructor(config: WebhookHandlerConfig) {
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * 處理 Webhook 請求
   *
   * @param rawBody 原始請求 body
   * @param signature 請求簽名（來自 x-webhook-signature header）
   * @returns 處理結果
   */
  async handleWebhook(
    rawBody: string,
    signature: string,
  ): Promise<WebhookHandlerResult> {
    // 檢查簽名是否存在
    if (!signature) {
      return {
        success: false,
        error: "MISSING_SIGNATURE",
      };
    }

    // 驗證簽名
    const isValid = await this.verifySignature(rawBody, signature);
    if (!isValid) {
      return {
        success: false,
        error: "INVALID_SIGNATURE",
      };
    }

    // 解析 JSON
    let parsedEvent: unknown;
    try {
      parsedEvent = JSON.parse(rawBody);
    } catch {
      console.error("Webhook JSON 解析失敗");
      return {
        success: false,
        error: "INVALID_JSON",
      };
    }

    // 驗證事件格式
    if (!this.isValidEventFormat(parsedEvent)) {
      console.error("Webhook 事件格式無效");
      return {
        success: false,
        error: "INVALID_EVENT_FORMAT",
      };
    }

    // 驗證事件類型
    const event = parsedEvent as WebhookEvent;
    if (!VALID_EVENT_TYPES.includes(event.type)) {
      console.error(`未知的事件類型: ${event.type}`);
      return {
        success: false,
        error: "UNKNOWN_EVENT_TYPE",
      };
    }

    return {
      success: true,
      event,
    };
  }

  /**
   * 驗證 Webhook 簽名
   *
   * @param rawBody 原始請求 body
   * @param signature 請求簽名
   * @returns 簽名是否有效
   */
  async verifySignature(rawBody: string, signature: string): Promise<boolean> {
    try {
      const expectedSignature = await this.computeHmac(rawBody);
      return this.timingSafeEqual(signature, expectedSignature);
    } catch (error) {
      console.error("簽名驗證失敗:", error);
      return false;
    }
  }

  /**
   * 計算 HMAC-SHA256 簽名
   */
  private async computeHmac(message: string): Promise<string> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(this.webhookSecret);
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
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * 驗證事件格式是否有效
   */
  private isValidEventFormat(event: unknown): boolean {
    if (typeof event !== "object" || event === null) {
      return false;
    }

    const obj = event as Record<string, unknown>;

    // 必須有 type、data、timestamp
    if (typeof obj.type !== "string") {
      return false;
    }

    if (typeof obj.data !== "object" || obj.data === null) {
      return false;
    }

    if (typeof obj.timestamp !== "string") {
      return false;
    }

    return true;
  }
}

/**
 * 建立 Webhook 處理器的工廠函數
 *
 * @param config 配置
 * @returns PayUniWebhookHandler 實例
 */
export function createWebhookHandler(
  config: WebhookHandlerConfig,
): PayUniWebhookHandler {
  return new PayUniWebhookHandler(config);
}
