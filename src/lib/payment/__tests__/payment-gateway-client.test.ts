/**
 * 金流微服務 SDK 測試
 *
 * TDD 紅燈階段：先寫測試，再實作代碼
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PaymentGatewayClient,
  PaymentGatewayError,
  createPaymentGatewayClient,
} from "../payment-gateway-client";

describe("PaymentGatewayClient", () => {
  describe("初始化", () => {
    it("應該正確初始化 SDK", () => {
      const client = new PaymentGatewayClient({
        apiKey: "test-api-key-1234567890",
        siteCode: "AUTOSEO",
        webhookSecret: "test-webhook-secret",
        environment: "sandbox",
      });

      expect(client.getEnvironment()).toBe("sandbox");
      expect(client.getBaseUrl()).toBe("https://sandbox.affiliate.1wayseo.com");
    });

    it("缺少 API Key 時應該拋出錯誤", () => {
      expect(() => {
        new PaymentGatewayClient({
          apiKey: "",
          siteCode: "AUTOSEO",
        });
      }).toThrow(PaymentGatewayError);
    });

    it("缺少 Site Code 時應該拋出錯誤", () => {
      expect(() => {
        new PaymentGatewayClient({
          apiKey: "test-api-key-1234567890",
          siteCode: "",
        });
      }).toThrow(PaymentGatewayError);
    });

    it("production 環境應該使用正確的 baseUrl", () => {
      const client = new PaymentGatewayClient({
        apiKey: "test-api-key-1234567890",
        siteCode: "AUTOSEO",
        environment: "production",
      });

      expect(client.getEnvironment()).toBe("production");
      expect(client.getBaseUrl()).toBe("https://affiliate.1wayseo.com");
    });

    it("預設環境應該是 production", () => {
      const client = new PaymentGatewayClient({
        apiKey: "test-api-key-1234567890",
        siteCode: "AUTOSEO",
      });

      expect(client.getEnvironment()).toBe("production");
    });

    it("可以使用自訂 baseUrl 覆寫環境設定", () => {
      const client = new PaymentGatewayClient({
        apiKey: "test-api-key-1234567890",
        siteCode: "AUTOSEO",
        baseUrl: "http://localhost:3000",
      });

      expect(client.getBaseUrl()).toBe("http://localhost:3000");
    });
  });

  describe("createPaymentGatewayClient 工廠函數", () => {
    it("應該建立 PaymentGatewayClient 實例", () => {
      const client = createPaymentGatewayClient({
        apiKey: "test-api-key-1234567890",
        siteCode: "AUTOSEO",
        environment: "sandbox",
      });

      expect(client).toBeInstanceOf(PaymentGatewayClient);
    });
  });

  describe("靜態工具方法", () => {
    it("formatAmount 應該正確格式化金額", () => {
      expect(PaymentGatewayClient.formatAmount(1990)).toBe("NT$1,990");
      expect(PaymentGatewayClient.formatAmount(100000)).toBe("NT$100,000");
    });

    it("isValidOrderId 應該驗證訂單 ID 格式", () => {
      expect(PaymentGatewayClient.isValidOrderId("ORDER-123")).toBe(true);
      expect(PaymentGatewayClient.isValidOrderId("order_456")).toBe(true);
      expect(PaymentGatewayClient.isValidOrderId("")).toBe(false);
      expect(PaymentGatewayClient.isValidOrderId("a".repeat(51))).toBe(false);
      expect(PaymentGatewayClient.isValidOrderId("order 123")).toBe(false); // 空格不允許
    });

    it("isValidEmail 應該驗證 Email 格式", () => {
      expect(PaymentGatewayClient.isValidEmail("user@example.com")).toBe(true);
      expect(PaymentGatewayClient.isValidEmail("invalid-email")).toBe(false);
      expect(PaymentGatewayClient.isValidEmail("")).toBe(false);
    });
  });
});

describe("createPayment", () => {
  let client: PaymentGatewayClient;

  beforeEach(() => {
    client = new PaymentGatewayClient({
      apiKey: "test-api-key-1234567890",
      siteCode: "AUTOSEO",
      environment: "sandbox",
    });

    // Mock fetch
    global.fetch = vi.fn();
  });

  it("應該成功建立一次性付款", async () => {
    const mockResponse = {
      success: true,
      paymentId: "pay_123",
      newebpayForm: {
        action: "https://ccore.newebpay.com/MPG/mpg_gateway",
        method: "POST",
        fields: {
          MerchantID: "TEST123",
          TradeInfo: "encrypted_data",
          TradeSha: "sha256_hash",
          Version: "2.0",
        },
      },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.createPayment({
      orderId: "ORDER-001",
      amount: 1990,
      description: "專業版訂閱",
      email: "user@example.com",
    });

    expect(result.success).toBe(true);
    expect(result.paymentId).toBe("pay_123");
    expect(result.newebpayForm).toBeDefined();
    expect(result.newebpayForm?.action).toContain("newebpay.com");
  });

  it("應該成功建立定期定額付款", async () => {
    const mockResponse = {
      success: true,
      paymentId: "pay_456",
      isPeriodPayment: true,
      newebpayForm: {
        action: "https://ccore.newebpay.com/MPG/period",
        method: "POST",
        fields: {
          MerchantID_: "TEST123",
          PostData_: "encrypted_data",
        },
      },
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.createPayment({
      orderId: "SUB-001",
      amount: 299,
      description: "月費方案",
      email: "user@example.com",
      periodParams: {
        periodType: "M",
        periodPoint: "01",
        periodTimes: 12,
        periodStartType: 2,
      },
    });

    expect(result.success).toBe(true);
    expect(result.isPeriodPayment).toBe(true);
    expect(result.newebpayForm?.fields).toHaveProperty("MerchantID_");
  });

  it("金額為 0 或負數時應該拋出錯誤", async () => {
    await expect(
      client.createPayment({
        orderId: "ORDER-001",
        amount: 0,
        description: "測試",
        email: "user@example.com",
      }),
    ).rejects.toThrow(PaymentGatewayError);

    await expect(
      client.createPayment({
        orderId: "ORDER-001",
        amount: -100,
        description: "測試",
        email: "user@example.com",
      }),
    ).rejects.toThrow(PaymentGatewayError);
  });

  it("Email 格式錯誤時應該拋出錯誤", async () => {
    await expect(
      client.createPayment({
        orderId: "ORDER-001",
        amount: 100,
        description: "測試",
        email: "invalid-email",
      }),
    ).rejects.toThrow(PaymentGatewayError);
  });

  it("orderId 格式錯誤時應該拋出錯誤", async () => {
    await expect(
      client.createPayment({
        orderId: "order with spaces",
        amount: 100,
        description: "測試",
        email: "user@example.com",
      }),
    ).rejects.toThrow(PaymentGatewayError);
  });

  it("API 返回錯誤時應該拋出 PaymentGatewayError", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "無效的 API Key" }),
    });

    await expect(
      client.createPayment({
        orderId: "ORDER-001",
        amount: 100,
        description: "測試",
        email: "user@example.com",
      }),
    ).rejects.toThrow(PaymentGatewayError);
  });
});

describe("Webhook 驗證", () => {
  let client: PaymentGatewayClient;

  beforeEach(() => {
    client = new PaymentGatewayClient({
      apiKey: "test-api-key-1234567890",
      siteCode: "AUTOSEO",
      webhookSecret: "test-webhook-secret-12345",
      environment: "sandbox",
    });
  });

  it("應該成功生成簽名", async () => {
    const payload = { paymentId: "pay_123", status: "SUCCESS" };
    const signature = await client.generateSignature(payload);

    expect(signature).toBeDefined();
    expect(typeof signature).toBe("string");
    expect(signature.length).toBe(64); // SHA256 hex = 64 chars
  });

  it("應該成功驗證正確的簽名", async () => {
    const payload = { paymentId: "pay_123", status: "SUCCESS" };
    const signature = await client.generateSignature(payload);

    const isValid = await client.verifyWebhookSignature(payload, signature);
    expect(isValid).toBe(true);
  });

  it("錯誤的簽名應該驗證失敗", async () => {
    const payload = { paymentId: "pay_123", status: "SUCCESS" };
    const wrongSignature = "wrong_signature_1234567890abcdef";

    const isValid = await client.verifyWebhookSignature(
      payload,
      wrongSignature,
    );
    expect(isValid).toBe(false);
  });

  it("缺少 webhookSecret 時應該拋出錯誤", async () => {
    const clientWithoutSecret = new PaymentGatewayClient({
      apiKey: "test-api-key-1234567890",
      siteCode: "AUTOSEO",
      environment: "sandbox",
    });

    await expect(
      clientWithoutSecret.generateSignature({ test: "data" }),
    ).rejects.toThrow(PaymentGatewayError);
  });

  it("parseWebhookEvent 應該驗證並解析事件", async () => {
    const payload = {
      paymentId: "pay_123",
      orderId: "ORDER-001",
      status: "SUCCESS",
      amount: 1990,
    };
    const rawBody = JSON.stringify(payload);
    const signature = await client.generateSignature(payload);

    const event = await client.parseWebhookEvent(rawBody, signature);

    expect(event.paymentId).toBe("pay_123");
    expect(event.orderId).toBe("ORDER-001");
    expect(event.status).toBe("SUCCESS");
  });

  it("parseWebhookEvent 簽名錯誤時應該拋出錯誤", async () => {
    const rawBody = JSON.stringify({ paymentId: "pay_123" });

    await expect(
      client.parseWebhookEvent(rawBody, "invalid_signature"),
    ).rejects.toThrow(PaymentGatewayError);
  });

  it("parseWebhookEvent 缺少簽名時應該拋出錯誤", async () => {
    const rawBody = JSON.stringify({ paymentId: "pay_123" });

    await expect(client.parseWebhookEvent(rawBody, null)).rejects.toThrow(
      PaymentGatewayError,
    );
  });
});

describe("getPaymentStatus", () => {
  let client: PaymentGatewayClient;

  beforeEach(() => {
    client = new PaymentGatewayClient({
      apiKey: "test-api-key-1234567890",
      siteCode: "AUTOSEO",
      environment: "sandbox",
    });

    global.fetch = vi.fn();
  });

  it("應該成功查詢付款狀態", async () => {
    const mockResponse = {
      paymentId: "pay_123",
      orderId: "ORDER-001",
      status: "SUCCESS",
      amount: 1990,
      paidAt: "2025-12-22T10:00:00Z",
      newebpayTradeNo: "NEWEBPAY123",
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await client.getPaymentStatus("pay_123");

    expect(result.paymentId).toBe("pay_123");
    expect(result.status).toBe("SUCCESS");
    expect(result.amount).toBe(1990);
  });

  it("paymentId 為空時應該拋出錯誤", async () => {
    await expect(client.getPaymentStatus("")).rejects.toThrow(
      PaymentGatewayError,
    );
  });
});
