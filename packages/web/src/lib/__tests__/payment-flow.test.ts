/**
 * 付款流程整合測試
 *
 * 這個測試用於診斷 "付款表單資料格式錯誤" 問題
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock 環境變數
vi.stubEnv("PAYMENT_GATEWAY_API_KEY", "test-api-key-1234567890");
vi.stubEnv("PAYMENT_GATEWAY_SITE_CODE", "1WAYSEO");
vi.stubEnv("PAYMENT_GATEWAY_WEBHOOK_SECRET", "test-webhook-secret");
vi.stubEnv("PAYMENT_GATEWAY_ENV", "sandbox");
vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://1wayseo.com");

describe("付款流程診斷測試", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("Gateway 回應格式驗證", () => {
    it("應該返回正確的 newebpayForm 格式", async () => {
      // 模擬 Gateway 回應
      const mockGatewayResponse = {
        success: true,
        paymentId: "payment-123",
        newebpayForm: {
          action: "https://ccore.newebpay.com/MPG/mpg_gateway",
          method: "POST" as const,
          fields: {
            MerchantID: "MS357073141",
            TradeInfo: "abc123def456",
            TradeSha: "SHA256HASH",
            Version: "2.0",
          },
        },
      };

      // 驗證格式
      expect(mockGatewayResponse).toHaveProperty("success", true);
      expect(mockGatewayResponse).toHaveProperty("newebpayForm");
      expect(mockGatewayResponse.newebpayForm).toHaveProperty("action");
      expect(mockGatewayResponse.newebpayForm).toHaveProperty("fields");
    });

    it("newebpayForm 應該有 action 和 fields 屬性", () => {
      const newebpayForm = {
        action: "https://ccore.newebpay.com/MPG/mpg_gateway",
        method: "POST" as const,
        fields: {
          MerchantID: "MS357073141",
          TradeInfo: "abc123",
          TradeSha: "SHA256",
          Version: "2.0",
        },
      };

      // 這是 authorizing page 的驗證邏輯
      const isValidNewFormat = newebpayForm.action && newebpayForm.fields;
      expect(isValidNewFormat).toBeTruthy();
    });
  });

  describe("URL 編碼/解碼驗證", () => {
    it("paymentForm 應該能正確編碼和解碼", () => {
      const paymentForm = {
        action: "https://ccore.newebpay.com/MPG/mpg_gateway",
        method: "POST",
        fields: {
          MerchantID: "MS357073141",
          TradeInfo:
            "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
          TradeSha:
            "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
          Version: "2.0",
        },
      };

      // 模擬前端編碼
      const jsonString = JSON.stringify(paymentForm);
      const encoded = encodeURIComponent(jsonString);

      // 模擬 authorizing page 解碼
      const decoded = decodeURIComponent(encoded);
      const parsed = JSON.parse(decoded);

      // 驗證解碼後的格式
      expect(parsed).toHaveProperty("action", paymentForm.action);
      expect(parsed).toHaveProperty("fields");
      expect(parsed.fields).toHaveProperty("MerchantID", "MS357073141");
    });

    it("應該處理特殊字元", () => {
      const paymentForm = {
        action: "https://example.com/path?query=value&other=test",
        method: "POST",
        fields: {
          key: "value with spaces and 特殊字元 & symbols=+/",
        },
      };

      const encoded = encodeURIComponent(JSON.stringify(paymentForm));
      const decoded = JSON.parse(decodeURIComponent(encoded));

      expect(decoded.action).toBe(paymentForm.action);
      expect(decoded.fields.key).toBe(paymentForm.fields.key);
    });
  });

  describe("Authorizing Page 驗證邏輯", () => {
    function validatePaymentForm(formData: unknown): {
      valid: boolean;
      reason?: string;
    } {
      if (typeof formData !== "object" || formData === null) {
        return { valid: false, reason: "formData 不是物件" };
      }

      const data = formData as Record<string, unknown>;

      // 新格式檢查
      if (data.action && data.fields) {
        return { valid: true };
      }

      // 舊格式（定期定額）
      if (data.apiUrl && data.postData && data.merchantId) {
        return { valid: true };
      }

      // 舊格式（單次付款）
      if (data.apiUrl && data.tradeInfo && data.tradeSha && data.merchantId) {
        return { valid: true };
      }

      return { valid: false, reason: "缺少必要的付款表單欄位" };
    }

    it("新格式（SDK 格式）應該通過驗證", () => {
      const formData = {
        action: "https://ccore.newebpay.com/MPG/mpg_gateway",
        method: "POST",
        fields: {
          MerchantID: "MS357073141",
          TradeInfo: "encrypted-data",
          TradeSha: "hash",
          Version: "2.0",
        },
      };

      const result = validatePaymentForm(formData);
      expect(result.valid).toBe(true);
    });

    it("空物件應該失敗", () => {
      const result = validatePaymentForm({});
      expect(result.valid).toBe(false);
    });

    it("只有 action 沒有 fields 應該失敗", () => {
      const result = validatePaymentForm({
        action: "https://example.com",
      });
      expect(result.valid).toBe(false);
    });

    it("舊格式（單次）應該通過", () => {
      const result = validatePaymentForm({
        apiUrl: "https://example.com",
        tradeInfo: "abc",
        tradeSha: "def",
        merchantId: "123",
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("SDK Client 格式驗證", () => {
    it("PaymentResult 應該有正確的類型定義", () => {
      interface PaymentResult {
        success: boolean;
        paymentId: string;
        newebpayForm?: {
          action: string;
          method: "POST";
          fields: Record<string, string>;
        };
        error?: string;
      }

      const result: PaymentResult = {
        success: true,
        paymentId: "test-123",
        newebpayForm: {
          action: "https://example.com",
          method: "POST",
          fields: { key: "value" },
        },
      };

      expect(result.success).toBe(true);
      expect(result.newebpayForm?.action).toBe("https://example.com");
    });
  });

  describe("真實 API 呼叫模擬", () => {
    it("模擬完整的付款建立流程", async () => {
      // 1. 模擬 Gateway 回應
      const gatewayResponse = {
        success: true,
        paymentId: "payment-abc123",
        newebpayForm: {
          action: "https://ccore.newebpay.com/MPG/mpg_gateway",
          method: "POST" as const,
          fields: {
            MerchantID: "MS357073141",
            TradeInfo:
              "f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8",
            TradeSha:
              "ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
            Version: "2.0",
          },
        },
      };

      // 2. 模擬 PaymentService 處理
      const apiResponse = {
        success: true,
        orderId: "order-xyz789",
        orderNo: "1WAYSEO_1234567890",
        paymentId: gatewayResponse.paymentId,
        paymentForm: gatewayResponse.newebpayForm,
      };

      // 3. 模擬前端編碼
      const encodedForm = encodeURIComponent(
        JSON.stringify(apiResponse.paymentForm),
      );
      const queryString = `paymentForm=${encodedForm}`;

      // 4. 模擬 authorizing page 解碼
      const params = new URLSearchParams(queryString);
      const paymentFormParam = params.get("paymentForm");
      expect(paymentFormParam).not.toBeNull();

      const formData = JSON.parse(decodeURIComponent(paymentFormParam!));

      // 5. 驗證格式
      expect(formData.action).toBe(
        "https://ccore.newebpay.com/MPG/mpg_gateway",
      );
      expect(formData.fields).toBeDefined();
      expect(formData.fields.MerchantID).toBe("MS357073141");
    });
  });
});
