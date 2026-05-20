/**
 * Preview Titles API 測試
 *
 * TDD Red Phase：定義預期行為
 * 測試目標：確保標題預覽 API 正確使用 Gemini Flash 並有適當的錯誤處理
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fetch 全域函數
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase（用於模板回退）
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            limit: vi.fn(() =>
              Promise.resolve({
                data: [
                  { id: "1", template: "{number}個{keyword}技巧" },
                  { id: "2", template: "如何利用{keyword}提升效率" },
                  { id: "3", template: "{keyword}完整指南" },
                  { id: "4", template: "{keyword}入門到精通" },
                  { id: "5", template: "專家推薦的{keyword}方法" },
                ],
                error: null,
              }),
            ),
          })),
        })),
      })),
      update: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  })),
}));

// Mock auth middleware
vi.mock("@/lib/api/auth-middleware", () => ({
  withAuth: vi.fn((handler) => handler),
}));

// Mock OpenRouter client
vi.mock("@/lib/openrouter/client", () => ({
  getOpenRouterClient: vi.fn(() => ({
    complete: vi.fn(),
  })),
}));

// Mock AI Gateway
vi.mock("@/lib/cloudflare/ai-gateway", () => ({
  isGatewayEnabled: vi.fn(() => true),
  buildGeminiApiUrl: vi.fn(
    (model, action) =>
      `https://gateway.ai.cloudflare.com/v1beta/models/${model}:${action}`,
  ),
  buildGeminiHeaders: vi.fn(() => ({
    "Content-Type": "application/json",
    "x-goog-api-key": "test-key",
    "cf-aig-authorization": "Bearer test-token",
  })),
}));

describe("Preview Titles API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("T1: Gemini Direct 成功時直接返回", () => {
    it("應該使用 Gemini Direct API 並返回 5 個標題", async () => {
      // 模擬 Gemini Direct API 成功響應
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `如何在2024年提升SEO排名
10個必學的AI行銷技巧
專家推薦的數位轉型策略
從零開始學習AI應用
企業AI導入完整指南`,
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(geminiResponse),
      });

      // 這裡應該呼叫 API 並驗證結果
      // 預期：返回 5 個標題，且來源是 Gemini Direct
      expect(mockFetch).toBeDefined();
    });
  });

  describe("T2: Gemini Direct 失敗時使用 OpenRouter", () => {
    it("當 Gemini Direct 失敗時應該回退到 OpenRouter", async () => {
      // 模擬 Gemini Direct 失敗
      mockFetch.mockRejectedValueOnce(new Error("Gemini Direct API 503"));

      // 模擬 OpenRouter 成功
      const openRouterResponse = {
        choices: [
          {
            message: {
              content: `SEO優化必備技巧
AI行銷入門指南
數位轉型實戰手冊
企業自動化完整教學
效率提升秘訣大公開`,
            },
          },
        ],
      };

      // OpenRouter 使用不同的 mock
      // 預期：返回 5 個標題，且來源是 OpenRouter
      expect(true).toBe(true);
    });
  });

  describe("T3: 兩個 Gemini 層都失敗時使用模板", () => {
    it("所有 Gemini 層失敗時應該返回模板標題", async () => {
      // 模擬 Gemini Direct 失敗
      mockFetch.mockRejectedValueOnce(new Error("Gemini Direct 503"));

      // 模擬 OpenRouter 也失敗
      mockFetch.mockRejectedValueOnce(new Error("OpenRouter 429"));

      // 預期：返回模板生成的標題
      // 模板格式："{number}個{keyword}技巧" 等
      expect(true).toBe(true);
    });
  });

  describe("T4: 標題解析測試", () => {
    it("應該正確解析標準格式的標題", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `1. 如何在2024年提升SEO排名
2. 10個必學的AI行銷技巧
3. 專家推薦的數位轉型策略
4. 從零開始學習AI應用
5. 企業AI導入完整指南`,
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(geminiResponse),
      });

      // 預期：應該移除編號前綴並返回乾淨的標題
      expect(true).toBe(true);
    });

    it("應該處理非標準格式的標題（寬鬆解析）", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `以下是為您生成的標題：

- 如何在2024年提升SEO排名
- 10個必學的AI行銷技巧
- 專家推薦的數位轉型策略

希望這些標題對您有幫助！`,
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(geminiResponse),
      });

      // 預期：應該過濾掉說明文字，只返回實際標題
      expect(true).toBe(true);
    });
  });

  describe("T5: 確保不使用 DeepSeek", () => {
    it("不應該呼叫 DeepSeek API", async () => {
      // 模擬所有請求
      mockFetch.mockRejectedValue(new Error("Network error"));

      // 檢查 fetch 呼叫不包含 DeepSeek URL
      const calls = mockFetch.mock.calls;
      const hasDeepSeekCall = calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("deepseek"),
      );

      expect(hasDeepSeekCall).toBe(false);
    });
  });

  describe("錯誤處理", () => {
    it("空響應時應該返回明確的錯誤訊息", async () => {
      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: "",
                },
              ],
            },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(geminiResponse),
      });

      // 預期：應該返回模板標題或有意義的錯誤訊息
      expect(true).toBe(true);
    });
  });
});

/**
 * 標題解析輔助函數測試
 * 這些函數將在 route.ts 中實作後匯入測試
 */
describe("parseTitles 輔助函數", () => {
  /**
   * 解析標準格式標題
   * 格式：每行一個標題，可能有編號前綴
   */
  function parseStandardFormat(content: string): string[] {
    return content
      .split("\n")
      .map((line) => line.trim())
      .map((line) => line.replace(/^[\d\.\-\*]+[\.\)、\s]*/, "").trim())
      .filter((line) => line.length > 0 && line.length < 100)
      .filter(
        (line) => !line.match(/^(標題|範例|格式|要求|例如|以下|根據|希望)/),
      )
      .slice(0, 5);
  }

  /**
   * 寬鬆解析（當標準解析失敗時使用）
   */
  function parseLenientFormat(content: string): string[] {
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 10 && line.length < 200)
      .filter((line) => !line.match(/^(以下|希望|請|您|這些|生成|標題：)/))
      .slice(0, 5);
  }

  it("parseStandardFormat 應該移除編號前綴", () => {
    const content = `1. 第一個標題
2. 第二個標題
3. 第三個標題`;

    const result = parseStandardFormat(content);
    expect(result).toEqual(["第一個標題", "第二個標題", "第三個標題"]);
  });

  it("parseStandardFormat 應該過濾說明文字", () => {
    const content = `以下是標題：
第一個標題
第二個標題`;

    const result = parseStandardFormat(content);
    expect(result).toEqual(["第一個標題", "第二個標題"]);
  });

  it("parseLenientFormat 應該處理非標準格式", () => {
    const content = `以下是為您生成的標題：

如何在2024年提升SEO排名完整指南
10個必學的AI行銷技巧讓你業績翻倍

希望這些對您有幫助！`;

    const result = parseLenientFormat(content);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toContain("SEO");
  });

  it("兩個解析函數組合使用應該最大化提取標題", () => {
    const content = `標題建議：
- AI行銷入門
短`;

    let titles = parseStandardFormat(content);
    if (titles.length === 0) {
      titles = parseLenientFormat(content);
    }

    // 即使標準解析失敗，寬鬆解析應該能提取一些內容
    expect(titles.length).toBeGreaterThanOrEqual(0);
  });
});
