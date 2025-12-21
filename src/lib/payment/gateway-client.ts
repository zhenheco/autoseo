/**
 * 金流微服務 SDK 客戶端封裝
 *
 * 提供 AutoSEO 專案使用金流微服務的統一入口。
 * 根據環境變數自動配置 sandbox 或 production 環境。
 */

import {
  PaymentGatewayClient,
  PaymentGatewayError,
  type PaymentGatewayConfig,
  type CreatePaymentParams,
  type PaymentResult,
  type PaymentStatusResult,
  type WebhookEvent,
  type Environment,
} from "./payment-gateway-client";

// ============================================================================
// 環境變數驗證
// ============================================================================

/**
 * 驗證必要的環境變數是否已設定
 */
function validateEnvironmentVariables(): void {
  const required = ["PAYMENT_GATEWAY_API_KEY", "PAYMENT_GATEWAY_SITE_CODE"];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new PaymentGatewayError(
      `缺少必要的環境變數：${missing.join(", ")}`,
      "MISSING_ENV_VARS",
    );
  }
}

// ============================================================================
// SDK 實例
// ============================================================================

let _client: PaymentGatewayClient | null = null;

/**
 * 取得金流微服務客戶端（單例）
 *
 * @returns PaymentGatewayClient 實例
 *
 * @example
 * ```typescript
 * const client = getPaymentGatewayClient();
 * const result = await client.createPayment({
 *   orderId: 'ORDER-001',
 *   amount: 1990,
 *   description: '專業版訂閱',
 *   email: 'user@example.com',
 * });
 * ```
 */
export function getPaymentGatewayClient(): PaymentGatewayClient {
  if (_client) {
    return _client;
  }

  validateEnvironmentVariables();

  const environment: Environment =
    process.env.PAYMENT_GATEWAY_ENV === "production" ? "production" : "sandbox";

  const config: PaymentGatewayConfig = {
    apiKey: process.env.PAYMENT_GATEWAY_API_KEY!,
    siteCode: process.env.PAYMENT_GATEWAY_SITE_CODE!,
    webhookSecret: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET,
    environment,
  };

  // 開發環境可以使用自訂 URL
  if (process.env.PAYMENT_GATEWAY_BASE_URL) {
    config.baseUrl = process.env.PAYMENT_GATEWAY_BASE_URL;
  }

  _client = new PaymentGatewayClient(config);

  console.log(
    `[PaymentGateway] 初始化完成，環境：${environment}，URL：${_client.getBaseUrl()}`,
  );

  return _client;
}

/**
 * 重置客戶端（用於測試）
 */
export function resetPaymentGatewayClient(): void {
  _client = null;
}

// ============================================================================
// 便利函數
// ============================================================================

/**
 * 建立付款
 *
 * @param params 付款參數
 * @returns 付款結果
 */
export async function createPayment(
  params: CreatePaymentParams,
): Promise<PaymentResult> {
  const client = getPaymentGatewayClient();
  return client.createPayment(params);
}

/**
 * 查詢付款狀態
 *
 * @param paymentId 付款 ID
 * @returns 付款狀態
 */
export async function getPaymentStatus(
  paymentId: string,
): Promise<PaymentStatusResult> {
  const client = getPaymentGatewayClient();
  return client.getPaymentStatus(paymentId);
}

/**
 * 解析並驗證 Webhook 事件
 *
 * @param rawBody 原始請求 body
 * @param signature X-Webhook-Signature header 值
 * @returns 驗證後的 Webhook 事件
 */
export async function parseWebhookEvent(
  rawBody: string,
  signature: string | null,
): Promise<WebhookEvent> {
  const client = getPaymentGatewayClient();
  return client.parseWebhookEvent(rawBody, signature);
}

/**
 * 驗證 Webhook 簽名
 *
 * @param payload Webhook 資料
 * @param signature 簽名
 * @returns 是否有效
 */
export async function verifyWebhookSignature(
  payload: object,
  signature: string,
): Promise<boolean> {
  const client = getPaymentGatewayClient();
  return client.verifyWebhookSignature(payload, signature);
}

// ============================================================================
// 重新導出類型
// ============================================================================

export {
  PaymentGatewayClient,
  PaymentGatewayError,
  type PaymentGatewayConfig,
  type CreatePaymentParams,
  type PaymentResult,
  type PaymentStatusResult,
  type WebhookEvent,
  type Environment,
};
