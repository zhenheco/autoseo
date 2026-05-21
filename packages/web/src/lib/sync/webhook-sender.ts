/**
 * Webhook 發送器
 * 負責發送 HMAC 簽章的 webhook 請求
 */

import crypto from "crypto";
import type {
  WebhookPayload,
  WebhookSendOptions,
  WebhookSignature,
} from "./types";

// 預設配置
const DEFAULT_TIMEOUT_MS = 30000; // 30 秒
const DEFAULT_RETRIES = 0; // 不自動重試，由 sync-service 處理
const SIGNATURE_HEADER = "x-webhook-signature";
const TIMESTAMP_HEADER = "x-webhook-timestamp";

/**
 * 生成 HMAC-SHA256 簽章
 * 簽章格式：HMAC-SHA256(timestamp.payload, secret)
 */
export function generateSignature(
  payload: string,
  secret: string,
  timestamp: number
): WebhookSignature {
  const signaturePayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signaturePayload, "utf8")
    .digest("hex");

  return {
    signature: `sha256=${signature}`,
    timestamp,
  };
}

/**
 * 驗證 HMAC-SHA256 簽章
 * @param payload - 原始 payload 字串
 * @param secret - HMAC 密鑰
 * @param signature - 接收到的簽章
 * @param timestamp - 接收到的時間戳
 * @param maxAgeMs - 簽章最大有效時間（預設 5 分鐘）
 */
export function verifySignature(
  payload: string,
  secret: string,
  signature: string,
  timestamp: number,
  maxAgeMs: number = 5 * 60 * 1000
): { valid: boolean; error?: string } {
  // 檢查時間戳是否在有效範圍內
  const now = Date.now();
  const age = now - timestamp;

  if (age > maxAgeMs) {
    return {
      valid: false,
      error: `Signature expired. Age: ${age}ms, Max: ${maxAgeMs}ms`,
    };
  }

  if (age < -60000) {
    // 允許 1 分鐘的時鐘偏差
    return {
      valid: false,
      error: "Signature timestamp is in the future",
    };
  }

  // 生成預期的簽章
  const expected = generateSignature(payload, secret, timestamp);

  // 使用 timingSafeEqual 防止時序攻擊
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected.signature);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Invalid signature format" };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    return isValid ? { valid: true } : { valid: false, error: "Invalid signature" };
  } catch {
    return { valid: false, error: "Signature verification failed" };
  }
}

/**
 * 發送 Webhook
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  secret: string | null | undefined,
  options: WebhookSendOptions = {}
): Promise<{
  success: boolean;
  status?: number;
  body?: string;
  error?: string;
  durationMs: number;
}> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    retryDelayMs = 1000,
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= retries) {
    try {
      const payloadString = JSON.stringify(payload);
      const timestamp = Date.now();

      // 建立 headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        [TIMESTAMP_HEADER]: timestamp.toString(),
        "User-Agent": "1waySEO-ArticleSync/1.0",
      };

      // 只有在有 secret 時才生成簽章
      if (secret) {
        const { signature } = generateSignature(payloadString, secret, timestamp);
        headers[SIGNATURE_HEADER] = signature;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const body = await response.text();

      if (response.ok) {
        return {
          success: true,
          status: response.status,
          body,
          durationMs,
        };
      }

      // 5xx 錯誤可以重試，4xx 錯誤不重試
      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error: ${response.status}`);
        attempt++;
        await delay(retryDelayMs * attempt); // 指數退避
        continue;
      }

      return {
        success: false,
        status: response.status,
        body,
        error: `HTTP ${response.status}: ${body.substring(0, 200)}`,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof Error) {
        // 網路錯誤可以重試
        if (
          (error.name === "AbortError" ||
            error.message.includes("network") ||
            error.message.includes("ECONNREFUSED")) &&
          attempt < retries
        ) {
          lastError = error;
          attempt++;
          await delay(retryDelayMs * attempt);
          continue;
        }

        return {
          success: false,
          error: error.message,
          durationMs,
        };
      }

      return {
        success: false,
        error: "Unknown error",
        durationMs,
      };
    }
  }

  // 所有重試都失敗
  return {
    success: false,
    error: lastError?.message || "Max retries exceeded",
    durationMs: Date.now() - startTime,
  };
}

/**
 * 延遲函數
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 批次發送 Webhook（並行）
 */
export async function sendWebhookBatch(
  targets: Array<{
    url: string;
    secret: string;
    slug: string;
  }>,
  payload: WebhookPayload,
  options: WebhookSendOptions = {}
): Promise<
  Array<{
    slug: string;
    success: boolean;
    status?: number;
    error?: string;
    durationMs: number;
  }>
> {
  const results = await Promise.all(
    targets.map(async (target) => {
      const result = await sendWebhook(target.url, payload, target.secret, options);
      return {
        slug: target.slug,
        ...result,
      };
    })
  );

  return results;
}
