/**
 * PAYUNi SDK 客戶端單元測試
 *
 * TDD 紅燈階段：先寫測試，再實作
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPayUniClient, type PayUniClientConfig } from "../payuni-client";

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("PayUniClient", () => {
  const validConfig: PayUniClientConfig = {
    apiKey: "test-api-key",
    siteCode: "test-site-code",
    webhookSecret: "test-webhook-secret",
    environment: "sandbox",
  };

  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("初始化", () => {
    it("應該成功建立客戶端", () => {
      const client = createPayUniClient(validConfig);
      expect(client).toBeDefined();
      expect(client.createPayment).toBeDefined();
      expect(client.createPeriodPayment).toBeDefined();
      expect(client.getPaymentStatus).toBeDefined();
      expect(client.verifyWebhook).toBeDefined();
    });

    it("應該使用正確的 sandbox URL", () => {
      const client = createPayUniClient({
        ...validConfig,
        environment: "sandbox",
      });
      expect(client.getBaseUrl()).toBe("https://sandbox.affiliate.1wayseo.com");
    });

    it("應該使用正確的 production URL", () => {
      const client = createPayUniClient({
        ...validConfig,
        environment: "production",
      });
      expect(client.getBaseUrl()).toBe("https://affiliate.1wayseo.com");
    });
  });

  describe("createPayment - 單次付款", () => {
    it("應該成功建立單次付款", async () => {
      const mockResponse = {
        success: true,
        data: {
          paymentId: "pay-123",
          payuniForm: {
            action: "https://api.payuni.com.tw/api/upp",
            method: "POST",
            fields: {
              MerID: "mer-123",
              Version: "1.0",
              EncryptInfo: "encrypted-data",
              HashInfo: "hash-data",
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = createPayUniClient(validConfig);
      const result = await client.createPayment({
        orderId: "order-123",
        amount: 100,
        email: "test@example.com",
        description: "測試商品",
      });

      expect(result.success).toBe(true);
      expect(result.data?.paymentId).toBe("pay-123");
      expect(result.data?.payuniForm).toBeDefined();
    });

    it("應該正確處理 API 錯誤", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: "VALIDATION_ERROR",
            message: "金額必須大於 0",
          }),
      });

      const client = createPayUniClient(validConfig);
      const result = await client.createPayment({
        orderId: "order-123",
        amount: 0,
        email: "test@example.com",
        description: "測試商品",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("VALIDATION_ERROR");
    });

    it("應該正確發送 API 請求 headers", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { paymentId: "pay-123", payuniForm: {} },
          }),
      });

      const client = createPayUniClient(validConfig);
      await client.createPayment({
        orderId: "order-123",
        amount: 100,
        email: "test@example.com",
        description: "測試商品",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://sandbox.affiliate.1wayseo.com/api/payment/payuni/create",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-API-Key": "test-api-key",
            "X-Site-Code": "test-site-code",
          }),
        }),
      );
    });
  });

  describe("createPeriodPayment - 定期定額", () => {
    it("應該成功建立定期定額付款", async () => {
      const mockResponse = {
        success: true,
        data: {
          paymentId: "period-pay-123",
          payuniForm: {
            action: "https://api.payuni.com.tw/api/upp",
            method: "POST",
            fields: {
              MerID: "mer-123",
              Version: "1.0",
              EncryptInfo: "encrypted-data",
              HashInfo: "hash-data",
            },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = createPayUniClient(validConfig);
      const result = await client.createPeriodPayment({
        orderId: "sub-123",
        periodParams: {
          periodAmt: 299,
          prodDesc: "月費訂閱",
          periodType: "month",
          periodDate: "1",
          periodTimes: 12,
          firstType: "build",
          payerEmail: "test@example.com",
        },
      });

      expect(result.success).toBe(true);
      expect(result.data?.paymentId).toBe("period-pay-123");
    });

    it("應該呼叫正確的 API 端點", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { paymentId: "pay-123", payuniForm: {} },
          }),
      });

      const client = createPayUniClient(validConfig);
      await client.createPeriodPayment({
        orderId: "sub-123",
        periodParams: {
          periodAmt: 299,
          prodDesc: "月費訂閱",
          periodType: "month",
          periodDate: "1",
          periodTimes: 12,
          firstType: "build",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://sandbox.affiliate.1wayseo.com/api/payment/payuni/period",
        expect.any(Object),
      );
    });
  });

  describe("getPaymentStatus - 查詢付款狀態", () => {
    it("應該成功查詢付款狀態", async () => {
      const mockResponse = {
        success: true,
        data: {
          paymentId: "pay-123",
          orderId: "order-123",
          status: "SUCCESS",
          amount: 100,
          currency: "TWD",
          description: "測試商品",
          paidAt: "2025-12-22T10:00:00Z",
          createdAt: "2025-12-22T09:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const client = createPayUniClient(validConfig);
      const result = await client.getPaymentStatus("pay-123");

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe("SUCCESS");
      expect(result.data?.amount).toBe(100);
    });

    it("應該處理付款不存在的情況", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () =>
          Promise.resolve({
            code: "PAYMENT_NOT_FOUND",
            message: "付款記錄不存在",
          }),
      });

      const client = createPayUniClient(validConfig);
      const result = await client.getPaymentStatus("non-existent");

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("PAYMENT_NOT_FOUND");
    });
  });

  describe("verifyWebhook - Webhook 驗證", () => {
    it("應該成功驗證正確的簽名", async () => {
      const client = createPayUniClient(validConfig);
      const payload = {
        type: "payment.success",
        data: {
          paymentId: "pay-123",
          orderId: "order-123",
          amount: 100,
          status: "SUCCESS",
        },
        timestamp: "2025-12-22T10:00:00Z",
      };
      const rawBody = JSON.stringify(payload);

      // 計算預期簽名
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

      const result = await client.verifyWebhook(rawBody, expectedSignature);

      expect(result).not.toBeNull();
      expect(result?.type).toBe("payment.success");
      expect(result?.data.paymentId).toBe("pay-123");
    });

    it("應該拒絕錯誤的簽名", async () => {
      const client = createPayUniClient(validConfig);
      const rawBody = JSON.stringify({
        type: "payment.success",
        data: { paymentId: "pay-123" },
      });

      const result = await client.verifyWebhook(rawBody, "wrong-signature");

      expect(result).toBeNull();
    });

    it("應該拒絕被竄改的資料", async () => {
      const client = createPayUniClient(validConfig);

      // 使用原始資料計算簽名
      const originalBody = JSON.stringify({ amount: 100 });
      const encoder = new TextEncoder();
      const keyData = encoder.encode(validConfig.webhookSecret);
      const messageData = encoder.encode(originalBody);
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
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 使用竄改後的資料驗證
      const tamperedBody = JSON.stringify({ amount: 999 });
      const result = await client.verifyWebhook(tamperedBody, signature);

      expect(result).toBeNull();
    });

    it("應該處理無效的 JSON", async () => {
      const client = createPayUniClient(validConfig);

      // 即使簽名正確，無效 JSON 也應該返回 null
      const result = await client.verifyWebhook(
        "invalid-json",
        "any-signature",
      );

      expect(result).toBeNull();
    });
  });

  describe("網路錯誤處理", () => {
    it("應該處理網路連接失敗", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const client = createPayUniClient(validConfig);
      const result = await client.createPayment({
        orderId: "order-123",
        amount: 100,
        email: "test@example.com",
        description: "測試商品",
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("NETWORK_ERROR");
    });

    it("應該處理 timeout", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 100),
          ),
      );

      const client = createPayUniClient(validConfig);
      const result = await client.createPayment({
        orderId: "order-123",
        amount: 100,
        email: "test@example.com",
        description: "測試商品",
      });

      expect(result.success).toBe(false);
    });
  });
});
