/**
 * PAYUNi Webhook 處理器單元測試
 *
 * TDD 紅燈階段：先寫測試，再實作
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PayUniWebhookHandler,
  type WebhookHandlerConfig,
  type WebhookHandlerResult,
} from "../payuni-webhook";

// Mock console
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});

describe("PayUniWebhookHandler", () => {
  const validConfig: WebhookHandlerConfig = {
    webhookSecret: "test-webhook-secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("初始化", () => {
    it("應該成功建立處理器", () => {
      const handler = new PayUniWebhookHandler(validConfig);
      expect(handler).toBeDefined();
    });
  });

  describe("簽名驗證", () => {
    it("應該正確計算 HMAC-SHA256 簽名", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const payload = { test: "data" };
      const rawBody = JSON.stringify(payload);

      // 手動計算預期簽名
      const encoder = new TextEncoder();
      const keyData = encoder.encode(validConfig.webhookSecret);
      const messageData = encoder.encode(rawBody);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        messageData,
      );
      const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const isValid = await handler.verifySignature(rawBody, expectedSignature);
      expect(isValid).toBe(true);
    });

    it("應該拒絕錯誤的簽名", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const rawBody = JSON.stringify({ test: "data" });

      const isValid = await handler.verifySignature(rawBody, "wrong-signature");
      expect(isValid).toBe(false);
    });

    it("應該防止 timing attack（時間安全比較）", async () => {
      const handler = new PayUniWebhookHandler(validConfig);

      // 測試不同長度的簽名
      const isValid1 = await handler.verifySignature('{"a":1}', "abc");
      const isValid2 = await handler.verifySignature('{"a":1}', "abcdefgh");

      expect(isValid1).toBe(false);
      expect(isValid2).toBe(false);
    });
  });

  describe("事件解析", () => {
    it("應該正確解析 payment.success 事件", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const event = {
        type: "payment.success",
        data: {
          paymentId: "pay-123",
          orderId: "order-123",
          amount: 100,
          status: "SUCCESS",
          tradeNo: "TN123456",
          paidAt: "2025-12-22T10:00:00Z",
        },
        timestamp: "2025-12-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(event);

      // 計算正確簽名
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(true);
      expect(result.event?.type).toBe("payment.success");
      expect(result.event?.data.paymentId).toBe("pay-123");
      expect(result.event?.data.amount).toBe(100);
    });

    it("應該正確解析 payment.failed 事件", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const event = {
        type: "payment.failed",
        data: {
          paymentId: "pay-456",
          orderId: "order-456",
          amount: 200,
          status: "FAILED",
          errorMessage: "卡片餘額不足",
        },
        timestamp: "2025-12-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(event);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(true);
      expect(result.event?.type).toBe("payment.failed");
      expect(result.event?.data.errorMessage).toBe("卡片餘額不足");
    });

    it("應該正確解析 period.authorized 事件", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const event = {
        type: "period.authorized",
        data: {
          paymentId: "period-123",
          orderId: "sub-123",
          amount: 299,
          status: "SUCCESS",
          periodTradeNo: "PT123456",
          currentPeriod: 1,
        },
        timestamp: "2025-12-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(event);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(true);
      expect(result.event?.type).toBe("period.authorized");
      expect(result.event?.data.periodTradeNo).toBe("PT123456");
      expect(result.event?.data.currentPeriod).toBe(1);
    });

    it("應該正確解析 period.deducted 事件", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const event = {
        type: "period.deducted",
        data: {
          paymentId: "period-123",
          orderId: "sub-123",
          amount: 299,
          status: "SUCCESS",
          periodTradeNo: "PT123456",
          currentPeriod: 2,
          paidAt: "2025-01-22T10:00:00Z",
        },
        timestamp: "2025-01-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(event);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(true);
      expect(result.event?.type).toBe("period.deducted");
      expect(result.event?.data.currentPeriod).toBe(2);
    });

    it("應該正確解析 period.failed 事件", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const event = {
        type: "period.failed",
        data: {
          paymentId: "period-123",
          orderId: "sub-123",
          amount: 299,
          status: "FAILED",
          periodTradeNo: "PT123456",
          currentPeriod: 3,
          errorMessage: "信用卡已過期",
        },
        timestamp: "2025-02-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(event);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(true);
      expect(result.event?.type).toBe("period.failed");
      expect(result.event?.data.errorMessage).toBe("信用卡已過期");
    });
  });

  describe("錯誤處理", () => {
    it("應該拒絕無效的簽名", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const rawBody = JSON.stringify({ type: "payment.success", data: {} });

      const result = await handler.handleWebhook(rawBody, "invalid-signature");

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_SIGNATURE");
    });

    it("應該拒絕空的簽名", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const rawBody = JSON.stringify({ type: "payment.success", data: {} });

      const result = await handler.handleWebhook(rawBody, "");

      expect(result.success).toBe(false);
      expect(result.error).toBe("MISSING_SIGNATURE");
    });

    it("應該拒絕無效的 JSON", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const rawBody = "invalid-json";
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_JSON");
    });

    it("應該拒絕缺少必要欄位的事件", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const invalidEvent = { type: "payment.success" }; // 缺少 data
      const rawBody = JSON.stringify(invalidEvent);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe("INVALID_EVENT_FORMAT");
    });

    it("應該拒絕未知的事件類型", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const invalidEvent = {
        type: "unknown.event",
        data: { paymentId: "123" },
        timestamp: "2025-12-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(invalidEvent);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(false);
      expect(result.error).toBe("UNKNOWN_EVENT_TYPE");
    });
  });

  describe("冪等性支援", () => {
    it("應該返回事件 ID 供冪等性檢查", async () => {
      const handler = new PayUniWebhookHandler(validConfig);
      const event = {
        type: "payment.success",
        data: {
          paymentId: "pay-123",
          orderId: "order-123",
          amount: 100,
          status: "SUCCESS",
        },
        timestamp: "2025-12-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(event);
      const signature = await computeSignature(
        rawBody,
        validConfig.webhookSecret,
      );

      const result = await handler.handleWebhook(rawBody, signature);

      expect(result.success).toBe(true);
      // 事件 ID 可用於冪等性檢查（paymentId + timestamp 組合）
      expect(result.event?.data.paymentId).toBeDefined();
      expect(result.event?.timestamp).toBeDefined();
    });
  });
});

/**
 * 輔助函數：計算 HMAC-SHA256 簽名
 */
async function computeSignature(
  message: string,
  secret: string,
): Promise<string> {
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
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
