/**
 * Affiliate System API Client 測試
 *
 * TDD 紅燈階段：先寫測試，確保 affiliate-client.ts 的功能正確
 *
 * 測試案例覆蓋：
 * 1. 環境變數未設定時的行為
 * 2. 環境變數已設定時的 API 呼叫
 * 3. 各種錯誤情況的處理
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 模擬環境變數
const mockEnv = {
  AFFILIATE_SYSTEM_URL: "https://affiliate.1wayseo.com",
  AFFILIATE_WEBHOOK_SECRET: "test-webhook-secret-123",
  AFFILIATE_PRODUCT_CODE: "autoseo",
};

// 動態匯入以便在每個測試中重設模組
async function importFreshModule() {
  // 清除模組快取
  vi.resetModules();
  return await import("../affiliate-client");
}

describe("AffiliateClient", () => {
  // 保存原始 fetch
  const originalFetch = global.fetch;

  beforeEach(() => {
    // 重設所有 mock
    vi.resetAllMocks();
  });

  afterEach(() => {
    // 恢復原始 fetch
    global.fetch = originalFetch;
    // 清除環境變數
    vi.unstubAllEnvs();
  });

  describe("當環境變數未設定時", () => {
    beforeEach(() => {
      // 確保環境變數未設定
      vi.stubEnv("AFFILIATE_SYSTEM_URL", "");
      vi.stubEnv("AFFILIATE_WEBHOOK_SECRET", "");
      vi.stubEnv("AFFILIATE_PRODUCT_CODE", "");
    });

    it("trackRegistration 應返回 null 並記錄警告", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const { trackRegistration } = await importFreshModule();

      const result = await trackRegistration({
        referralCode: "G3PHSQ71",
        referredUserId: "test-user-uuid",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[AffiliateClient] 系統未設定，跳過推薦追蹤",
      );
    });

    it("createCommission 應返回 null 並記錄警告", async () => {
      const consoleSpy = vi.spyOn(console, "warn");
      const { createCommission } = await importFreshModule();

      const result = await createCommission({
        referredUserId: "test-user-uuid",
        externalOrderId: "order-123",
        orderAmount: 1990,
        orderType: "subscription",
      });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "[AffiliateClient] 系統未設定，跳過佣金記錄",
      );
    });
  });

  describe("當環境變數已設定時", () => {
    beforeEach(() => {
      // 設定環境變數
      vi.stubEnv("AFFILIATE_SYSTEM_URL", mockEnv.AFFILIATE_SYSTEM_URL);
      vi.stubEnv("AFFILIATE_WEBHOOK_SECRET", mockEnv.AFFILIATE_WEBHOOK_SECRET);
      vi.stubEnv("AFFILIATE_PRODUCT_CODE", mockEnv.AFFILIATE_PRODUCT_CODE);
    });

    describe("trackRegistration", () => {
      it("成功時應返回 referralId", async () => {
        const mockResponse = {
          success: true,
          referralId: "ref-uuid-12345",
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const { trackRegistration } = await importFreshModule();

        const result = await trackRegistration({
          referralCode: "G3PHSQ71",
          referredUserId: "test-user-uuid",
        });

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${mockEnv.AFFILIATE_SYSTEM_URL}/api/tracking/registration`,
          expect.objectContaining({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": mockEnv.AFFILIATE_WEBHOOK_SECRET,
            },
            body: JSON.stringify({
              productCode: mockEnv.AFFILIATE_PRODUCT_CODE,
              referralCode: "G3PHSQ71",
              referredUserId: "test-user-uuid",
            }),
          }),
        );
      });

      it("409 錯誤（推薦關係已存在）應返回 null 並記錄日誌", async () => {
        const consoleSpy = vi.spyOn(console, "log");

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: "已存在推薦關係" }),
        });

        const { trackRegistration } = await importFreshModule();

        const result = await trackRegistration({
          referralCode: "G3PHSQ71",
          referredUserId: "test-user-uuid",
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[AffiliateClient] 推薦關係已存在，跳過",
        );
      });

      it("其他錯誤應返回 null 並記錄錯誤", async () => {
        const consoleSpy = vi.spyOn(console, "error");

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: "無效的推薦碼" }),
        });

        const { trackRegistration } = await importFreshModule();

        const result = await trackRegistration({
          referralCode: "INVALID1",
          referredUserId: "test-user-uuid",
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[AffiliateClient] 註冊追蹤失敗:",
          expect.any(Object),
        );
      });

      it("網路錯誤應返回 null 並記錄錯誤", async () => {
        const consoleSpy = vi.spyOn(console, "error");

        global.fetch = vi
          .fn()
          .mockRejectedValueOnce(new Error("Network error"));

        const { trackRegistration } = await importFreshModule();

        const result = await trackRegistration({
          referralCode: "G3PHSQ71",
          referredUserId: "test-user-uuid",
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[AffiliateClient] 註冊追蹤錯誤:",
          expect.any(Error),
        );
      });
    });

    describe("createCommission", () => {
      it("成功時應返回佣金資訊", async () => {
        const mockResponse = {
          success: true,
          commissionId: "comm-uuid-12345",
          baseRate: 20,
          tierBonus: 5,
          effectiveRate: 25,
          commissionAmount: 498,
          unlockAt: "2025-01-21T00:00:00.000Z",
        };

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

        const { createCommission } = await importFreshModule();

        const result = await createCommission({
          referredUserId: "test-user-uuid",
          externalOrderId: "order-123",
          orderAmount: 1990,
          orderType: "subscription",
        });

        expect(result).toEqual(mockResponse);
        expect(global.fetch).toHaveBeenCalledWith(
          `${mockEnv.AFFILIATE_SYSTEM_URL}/api/commissions/create`,
          expect.objectContaining({
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-webhook-secret": mockEnv.AFFILIATE_WEBHOOK_SECRET,
            },
            body: JSON.stringify({
              productCode: mockEnv.AFFILIATE_PRODUCT_CODE,
              currency: "TWD",
              referredUserId: "test-user-uuid",
              externalOrderId: "order-123",
              orderAmount: 1990,
              orderType: "subscription",
            }),
          }),
        );
      });

      it("找不到推薦關係時應靜默返回 null（不記錄錯誤）", async () => {
        const consoleErrorSpy = vi.spyOn(console, "error");

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: "找不到推薦關係" }),
        });

        const { createCommission } = await importFreshModule();

        const result = await createCommission({
          referredUserId: "non-referred-user",
          externalOrderId: "order-123",
          orderAmount: 1990,
          orderType: "subscription",
        });

        expect(result).toBeNull();
        // 不應該記錄錯誤（因為非推薦用戶是正常情況）
        expect(consoleErrorSpy).not.toHaveBeenCalled();
      });

      it("409 錯誤（重複訂單）應返回 null 並記錄日誌", async () => {
        const consoleSpy = vi.spyOn(console, "log");

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: "重複的訂單" }),
        });

        const { createCommission } = await importFreshModule();

        const result = await createCommission({
          referredUserId: "test-user-uuid",
          externalOrderId: "order-123",
          orderAmount: 1990,
          orderType: "subscription",
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[AffiliateClient] 訂單已存在，跳過",
        );
      });

      it("其他錯誤應返回 null 並記錄錯誤", async () => {
        const consoleSpy = vi.spyOn(console, "error");

        global.fetch = vi.fn().mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "伺服器錯誤" }),
        });

        const { createCommission } = await importFreshModule();

        const result = await createCommission({
          referredUserId: "test-user-uuid",
          externalOrderId: "order-123",
          orderAmount: 1990,
          orderType: "subscription",
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[AffiliateClient] 佣金記錄失敗:",
          expect.any(Object),
        );
      });

      it("網路錯誤應返回 null 並記錄錯誤", async () => {
        const consoleSpy = vi.spyOn(console, "error");

        global.fetch = vi
          .fn()
          .mockRejectedValueOnce(new Error("Network error"));

        const { createCommission } = await importFreshModule();

        const result = await createCommission({
          referredUserId: "test-user-uuid",
          externalOrderId: "order-123",
          orderAmount: 1990,
          orderType: "subscription",
        });

        expect(result).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          "[AffiliateClient] 佣金記錄錯誤:",
          expect.any(Error),
        );
      });
    });
  });

  describe("UTM 參數支援", () => {
    beforeEach(() => {
      vi.stubEnv("AFFILIATE_SYSTEM_URL", mockEnv.AFFILIATE_SYSTEM_URL);
      vi.stubEnv("AFFILIATE_WEBHOOK_SECRET", mockEnv.AFFILIATE_WEBHOOK_SECRET);
      vi.stubEnv("AFFILIATE_PRODUCT_CODE", mockEnv.AFFILIATE_PRODUCT_CODE);
    });

    it("trackRegistration 應正確傳送 UTM 參數", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, referralId: "ref-123" }),
      });

      const { trackRegistration } = await importFreshModule();

      await trackRegistration({
        referralCode: "G3PHSQ71",
        referredUserId: "test-user-uuid",
        sourceUrl: "https://1wayseo.com/pricing",
        utmSource: "facebook",
        utmMedium: "social",
        utmCampaign: "spring_2025",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            productCode: mockEnv.AFFILIATE_PRODUCT_CODE,
            referralCode: "G3PHSQ71",
            referredUserId: "test-user-uuid",
            sourceUrl: "https://1wayseo.com/pricing",
            utmSource: "facebook",
            utmMedium: "social",
            utmCampaign: "spring_2025",
          }),
        }),
      );
    });
  });
});
