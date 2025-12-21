/**
 * Webhook 處理器測試
 *
 * 測試金流微服務 Webhook 的接收和處理邏輯
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PaymentGatewayClient } from "../payment-gateway-client";

// 模擬 Webhook 處理函數
import {
  handleGatewayWebhook,
  type WebhookHandlerResult,
} from "../webhook-handler";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: null, error: null }),
          ),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));

describe("Webhook 處理器", () => {
  const webhookSecret = "test-webhook-secret-12345678901234567890";
  let client: PaymentGatewayClient;

  beforeEach(() => {
    client = new PaymentGatewayClient({
      apiKey: "test-api-key-1234567890",
      siteCode: "AUTOSEO",
      webhookSecret,
      environment: "sandbox",
    });

    // 設定環境變數
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = webhookSecret;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
  });

  describe("簽名驗證", () => {
    it("正確的簽名應該通過驗證", async () => {
      const payload = {
        paymentId: "pay_123",
        orderId: "ORD_1234567890_ABC",
        status: "SUCCESS" as const,
        amount: 1990,
        paidAt: "2025-12-22T10:00:00Z",
        newebpayTradeNo: "NEWEBPAY123",
      };

      const signature = await client.generateSignature(payload);
      const isValid = await client.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it("錯誤的簽名應該驗證失敗", async () => {
      const payload = {
        paymentId: "pay_123",
        orderId: "ORD_1234567890_ABC",
        status: "SUCCESS" as const,
        amount: 1990,
      };

      const isValid = await client.verifyWebhookSignature(
        payload,
        "wrong-signature",
      );

      expect(isValid).toBe(false);
    });

    it("被竄改的資料應該驗證失敗", async () => {
      const originalPayload = {
        paymentId: "pay_123",
        orderId: "ORD_1234567890_ABC",
        status: "SUCCESS" as const,
        amount: 1990,
      };

      const signature = await client.generateSignature(originalPayload);

      // 竄改資料
      const tamperedPayload = {
        ...originalPayload,
        amount: 9999, // 竄改金額
      };

      const isValid = await client.verifyWebhookSignature(
        tamperedPayload,
        signature,
      );

      expect(isValid).toBe(false);
    });
  });

  describe("Webhook 事件解析", () => {
    it("應該正確解析成功付款事件", async () => {
      const payload = {
        paymentId: "pay_123",
        orderId: "ORD_1234567890_ABC",
        status: "SUCCESS" as const,
        amount: 1990,
        paidAt: "2025-12-22T10:00:00Z",
        newebpayTradeNo: "NEWEBPAY123",
        metadata: { userId: "user_123" },
      };

      const rawBody = JSON.stringify(payload);
      const signature = await client.generateSignature(payload);

      const event = await client.parseWebhookEvent(rawBody, signature);

      expect(event.paymentId).toBe("pay_123");
      expect(event.orderId).toBe("ORD_1234567890_ABC");
      expect(event.status).toBe("SUCCESS");
      expect(event.amount).toBe(1990);
      expect(event.metadata).toEqual({ userId: "user_123" });
    });

    it("應該正確解析失敗付款事件", async () => {
      const payload = {
        paymentId: "pay_456",
        orderId: "ORD_1234567890_DEF",
        status: "FAILED" as const,
        amount: 1990,
        errorMessage: "卡片餘額不足",
      };

      const rawBody = JSON.stringify(payload);
      const signature = await client.generateSignature(payload);

      const event = await client.parseWebhookEvent(rawBody, signature);

      expect(event.status).toBe("FAILED");
      expect(event.errorMessage).toBe("卡片餘額不足");
    });

    it("無效 JSON 應該拋出錯誤", async () => {
      await expect(
        client.parseWebhookEvent("invalid json", "signature"),
      ).rejects.toThrow();
    });

    it("缺少簽名應該拋出錯誤", async () => {
      await expect(client.parseWebhookEvent("{}", null)).rejects.toThrow();
    });
  });
});

describe("handleGatewayWebhook", () => {
  const webhookSecret = "test-webhook-secret-12345678901234567890";

  beforeEach(() => {
    process.env.PAYMENT_GATEWAY_API_KEY = "test-api-key-1234567890";
    process.env.PAYMENT_GATEWAY_SITE_CODE = "AUTOSEO";
    process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET = webhookSecret;
    process.env.PAYMENT_GATEWAY_ENV = "sandbox";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.PAYMENT_GATEWAY_API_KEY;
    delete process.env.PAYMENT_GATEWAY_SITE_CODE;
    delete process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET;
    delete process.env.PAYMENT_GATEWAY_ENV;
  });

  // 注意：完整的業務邏輯測試需要正確 mock Supabase
  // 這裡只測試簽名驗證和錯誤處理

  it("簽名錯誤應該返回錯誤", async () => {
    const payload = {
      paymentId: "pay_123",
      orderId: "ORD_1234567890_ABC",
      status: "SUCCESS" as const,
      amount: 1990,
    };

    const rawBody = JSON.stringify(payload);

    const result = await handleGatewayWebhook(rawBody, "wrong-signature");

    expect(result.received).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("缺少簽名應該返回錯誤", async () => {
    const rawBody = JSON.stringify({ paymentId: "pay_123" });

    const result = await handleGatewayWebhook(rawBody, null);

    expect(result.received).toBe(false);
    expect(result.error).toBeDefined();
  });
});
