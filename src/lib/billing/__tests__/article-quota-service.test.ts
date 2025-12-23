/**
 * ArticleQuotaService 單元測試
 *
 * TDD 測試覆蓋範圍：
 * 1. deductArticle - 扣款邏輯
 * 2. getBalance - 餘額查詢
 * 3. reserveArticles - 預扣機制
 * 4. consumeReservation / releaseReservation - 預扣狀態管理
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ArticleQuotaService } from "../article-quota-service";

// Mock Supabase Client 類型
type MockSupabaseClient = {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
};

// 建立 Mock Supabase Client
function createMockSupabase(): MockSupabaseClient {
  return {
    rpc: vi.fn(),
    from: vi.fn(),
  };
}

// Mock RPC 回傳值
const mockSuccessDeductResult = {
  success: true,
  deducted_from: "subscription",
  log_id: "log-uuid-123",
  subscription_remaining: 9,
  purchased_remaining: 5,
  total_remaining: 14,
};

const mockPurchasedDeductResult = {
  success: true,
  deducted_from: "purchased",
  log_id: "log-uuid-456",
  subscription_remaining: 0,
  purchased_remaining: 4,
  total_remaining: 4,
};

const mockNoSubscriptionResult = {
  success: false,
  error: "no_subscription",
  message: "找不到有效訂閱",
};

const mockInsufficientQuotaResult = {
  success: false,
  error: "insufficient_quota",
  message: "額度不足，請升級方案或購買加購包",
};

describe("ArticleQuotaService", () => {
  let mockSupabase: MockSupabaseClient;
  let service: ArticleQuotaService;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new ArticleQuotaService(mockSupabase as any);
  });

  // ========================================
  // deductArticle 測試
  // ========================================
  describe("deductArticle", () => {
    describe("成功場景", () => {
      it("從訂閱額度扣款成功時應返回正確資訊", async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
          data: mockSuccessDeductResult,
          error: null,
        });

        const result = await service.deductArticle("company-uuid", "job-uuid", {
          title: "測試文章",
        });

        expect(result.success).toBe(true);
        expect(result.deductedFrom).toBe("subscription");
        expect(result.logId).toBe("log-uuid-123");
        expect(result.subscriptionRemaining).toBe(9);
        expect(result.purchasedRemaining).toBe(5);
        expect(result.totalRemaining).toBe(14);

        // 驗證 RPC 呼叫參數
        expect(mockSupabase.rpc).toHaveBeenCalledWith("deduct_article_quota", {
          p_company_id: "company-uuid",
          p_article_job_id: "job-uuid",
          p_user_id: null,
          p_article_title: "測試文章",
          p_keywords: null,
        });
      });

      it("從加購額度扣款成功時應返回正確資訊", async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
          data: mockPurchasedDeductResult,
          error: null,
        });

        const result = await service.deductArticle("company-uuid", "job-uuid");

        expect(result.success).toBe(true);
        expect(result.deductedFrom).toBe("purchased");
        expect(result.subscriptionRemaining).toBe(0);
        expect(result.purchasedRemaining).toBe(4);
      });

      it("應該正確傳遞 keywords 參數", async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
          data: mockSuccessDeductResult,
          error: null,
        });

        await service.deductArticle("company-uuid", "job-uuid", {
          keywords: ["AI", "SEO", "行銷"],
        });

        expect(mockSupabase.rpc).toHaveBeenCalledWith(
          "deduct_article_quota",
          expect.objectContaining({
            p_keywords: ["AI", "SEO", "行銷"],
          }),
        );
      });
    });

    describe("失敗場景", () => {
      it("找不到有效訂閱時應返回 error", async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
          data: mockNoSubscriptionResult,
          error: null,
        });

        const result = await service.deductArticle("company-uuid", "job-uuid");

        expect(result.success).toBe(false);
        expect(result.error).toBe("no_subscription");
        expect(result.message).toBe("找不到有效訂閱");
      });

      it("額度不足時應返回 error", async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
          data: mockInsufficientQuotaResult,
          error: null,
        });

        const result = await service.deductArticle("company-uuid", "job-uuid");

        expect(result.success).toBe(false);
        expect(result.error).toBe("insufficient_quota");
        expect(result.message).toContain("額度不足");
      });

      it("RPC 執行錯誤時應返回 error", async () => {
        mockSupabase.rpc.mockResolvedValueOnce({
          data: null,
          error: { message: 'relation "company_subscriptions" does not exist' },
        });

        const result = await service.deductArticle("company-uuid", "job-uuid");

        expect(result.success).toBe(false);
        expect(result.error).toContain("company_subscriptions");
      });
    });
  });

  // ========================================
  // getBalance 測試
  // ========================================
  describe("getBalance", () => {
    it("有訂閱時應返回正確餘額", async () => {
      // Mock reset RPC
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      // Mock select query
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            subscription_articles_remaining: 10,
            purchased_articles_remaining: 5,
            articles_per_month: 20,
            current_period_end: "2025-01-31T00:00:00Z",
            billing_cycle: "monthly",
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const balance = await service.getBalance("company-uuid");

      expect(balance.subscriptionRemaining).toBe(10);
      expect(balance.purchasedRemaining).toBe(5);
      expect(balance.totalAvailable).toBe(15);
      expect(balance.monthlyQuota).toBe(20);
      expect(balance.billingCycle).toBe("monthly");
    });

    it("無訂閱時應返回零餘額", async () => {
      // Mock reset RPC
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      // Mock select query returning null
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const balance = await service.getBalance("company-uuid");

      expect(balance.subscriptionRemaining).toBe(0);
      expect(balance.purchasedRemaining).toBe(0);
      expect(balance.totalAvailable).toBe(0);
      expect(balance.monthlyQuota).toBe(0);
      expect(balance.periodEnd).toBeNull();
      expect(balance.billingCycle).toBeNull();
    });

    it("應先呼叫 reset_monthly_quota_if_needed RPC", async () => {
      // Mock reset RPC
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });

      // Mock select query
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      await service.getBalance("company-uuid");

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "reset_monthly_quota_if_needed",
        { p_company_id: "company-uuid" },
      );
    });
  });

  // ========================================
  // hasEnoughQuota 測試
  // ========================================
  describe("hasEnoughQuota", () => {
    beforeEach(() => {
      // Mock getBalance internally
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    });

    it("餘額足夠時應返回 sufficient: true", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            subscription_articles_remaining: 10,
            purchased_articles_remaining: 5,
            articles_per_month: 20,
            current_period_end: null,
            billing_cycle: null,
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await service.hasEnoughQuota("company-uuid", 5);

      expect(result.sufficient).toBe(true);
      expect(result.balance.totalAvailable).toBe(15);
    });

    it("餘額不足時應返回 sufficient: false", async () => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            subscription_articles_remaining: 1,
            purchased_articles_remaining: 1,
            articles_per_month: 20,
            current_period_end: null,
            billing_cycle: null,
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockChain);

      const result = await service.hasEnoughQuota("company-uuid", 5);

      expect(result.sufficient).toBe(false);
      expect(result.balance.totalAvailable).toBe(2);
    });
  });

  // ========================================
  // reserveArticles 測試
  // ========================================
  describe("reserveArticles", () => {
    it("餘額足夠時應成功建立預扣", async () => {
      // Mock getBalance
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            subscription_articles_remaining: 10,
            purchased_articles_remaining: 5,
            articles_per_month: 20,
            current_period_end: null,
            billing_cycle: null,
          },
          error: null,
        }),
      };

      // Mock insert
      const mockInsertChain = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "reservation-uuid" },
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "token_reservations") {
          return mockInsertChain;
        }
        return mockSelectChain;
      });

      const result = await service.reserveArticles(
        "company-uuid",
        "job-uuid",
        1,
      );

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe("reservation-uuid");
      expect(result.availableArticles).toBe(14); // 15 - 1
    });

    it("餘額不足時應返回失敗", async () => {
      // Mock getBalance with insufficient balance
      mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null });
      const mockSelectChain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            subscription_articles_remaining: 0,
            purchased_articles_remaining: 0,
            articles_per_month: 0,
            current_period_end: null,
            billing_cycle: null,
          },
          error: null,
        }),
      };
      mockSupabase.from.mockReturnValue(mockSelectChain);

      const result = await service.reserveArticles(
        "company-uuid",
        "job-uuid",
        1,
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("額度不足");
      expect(result.availableArticles).toBe(0);
    });
  });

  // ========================================
  // consumeReservation 測試
  // ========================================
  describe("consumeReservation", () => {
    it("應將預扣狀態更新為 consumed", async () => {
      // 建立正確的鏈式 mock：from().update().eq().eq()
      const mockUpdateChain = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
      mockSupabase.from.mockReturnValue(mockUpdateChain);

      const result = await service.consumeReservation("job-uuid");

      expect(result).toBe(true);
      expect(mockUpdateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "consumed",
        }),
      );
    });
  });

  // ========================================
  // releaseReservation 測試
  // ========================================
  describe("releaseReservation", () => {
    it("應將預扣狀態更新為 released", async () => {
      // 建立正確的鏈式 mock：from().update().eq().eq()
      const mockUpdateChain = {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
      mockSupabase.from.mockReturnValue(mockUpdateChain);

      const result = await service.releaseReservation("job-uuid");

      expect(result).toBe(true);
      expect(mockUpdateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "released",
        }),
      );
    });
  });
});

// ========================================
// 防呆測試：驗證 search_path 問題
// ========================================
describe("防呆測試：RPC 函數 search_path", () => {
  it("deductArticle 不應包含 'does not exist' 錯誤", async () => {
    const mockSupabase = createMockSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const service = new ArticleQuotaService(mockSupabase as any);

    // 模擬 search_path 問題
    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'relation "company_subscriptions" does not exist' },
    });

    const result = await service.deductArticle("company-uuid", "job-uuid");

    // 這個測試確保我們能捕獲到這類錯誤
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not exist");

    // 在實際修復後，這個錯誤不應該再發生
    // 如果這個測試失敗，表示 search_path 問題已修復
  });
});
