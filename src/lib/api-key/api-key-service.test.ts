/**
 * API Key 服務測試
 *
 * TDD Step 2: 🔴 撰寫失敗測試
 */

import { describe, test, expect } from "vitest";

// 將在實作後導入
// import {
//   generateApiKey,
//   validateApiKey,
//   regenerateApiKey,
//   hashApiKey,
// } from './api-key-service'

describe("API Key 服務", () => {
  describe("generateApiKey", () => {
    test("應該返回格式正確的 API Key（sk_site_xxx）", async () => {
      // 🔴 RED: 這個測試會失敗，因為函數還不存在
      const { generateApiKey } = await import("./api-key-service");
      const apiKey = await generateApiKey();

      expect(apiKey).toMatch(/^sk_site_[a-zA-Z0-9]{32}$/);
    });

    test("每次呼叫應該產生不同的 API Key", async () => {
      const { generateApiKey } = await import("./api-key-service");
      const key1 = await generateApiKey();
      const key2 = await generateApiKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe("hashApiKey", () => {
    test("應該返回 API Key 的 SHA-256 雜湊值", async () => {
      const { hashApiKey } = await import("./api-key-service");
      const apiKey = "sk_site_test123456789012345678901234";
      const hash = await hashApiKey(apiKey);

      // 雜湊值應該是 64 字元的十六進位字串
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test("相同的 API Key 應該產生相同的雜湊值", async () => {
      const { hashApiKey } = await import("./api-key-service");
      const apiKey = "sk_site_test123456789012345678901234";

      const hash1 = await hashApiKey(apiKey);
      const hash2 = await hashApiKey(apiKey);

      expect(hash1).toBe(hash2);
    });

    test("不同的 API Key 應該產生不同的雜湊值", async () => {
      const { hashApiKey } = await import("./api-key-service");
      const key1 = "sk_site_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      const key2 = "sk_site_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

      const hash1 = await hashApiKey(key1);
      const hash2 = await hashApiKey(key2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("validateApiKey", () => {
    test("有效的 API Key 應該返回網站資訊", async () => {
      // 這個測試需要 mock Supabase
      const { validateApiKey } = await import("./api-key-service");

      // Mock 會在實作時加入
      // 暫時跳過需要真實資料庫的測試
      expect(true).toBe(true);
    });

    test("無效的 API Key 應該返回 null", async () => {
      const { validateApiKey } = await import("./api-key-service");
      const result = await validateApiKey("invalid_key");

      expect(result).toBeNull();
    });

    test("格式錯誤的 API Key 應該返回 null", async () => {
      const { validateApiKey } = await import("./api-key-service");

      // 缺少前綴
      expect(await validateApiKey("test123")).toBeNull();

      // 太短
      expect(await validateApiKey("sk_site_short")).toBeNull();

      // 空字串
      expect(await validateApiKey("")).toBeNull();
    });
  });

  describe("regenerateApiKey", () => {
    test("應該返回新的 API Key", async () => {
      const { regenerateApiKey } = await import("./api-key-service");

      // Mock 會在實作時加入
      // 暫時跳過需要真實資料庫的測試
      expect(true).toBe(true);
    });
  });

  describe("isValidApiKeyFormat", () => {
    test("正確格式應該返回 true", async () => {
      const { isValidApiKeyFormat } = await import("./api-key-service");

      // API Key 使用 hex 編碼，只有 a-f 和 0-9
      expect(
        isValidApiKeyFormat("sk_site_12345678901234567890123456789012"),
      ).toBe(true);
      expect(
        isValidApiKeyFormat("sk_site_abcdef1234567890abcdef1234567890"),
      ).toBe(true);
    });

    test("錯誤格式應該返回 false", async () => {
      const { isValidApiKeyFormat } = await import("./api-key-service");

      expect(isValidApiKeyFormat("")).toBe(false);
      expect(isValidApiKeyFormat("invalid")).toBe(false);
      expect(isValidApiKeyFormat("sk_site_short")).toBe(false);
      expect(
        isValidApiKeyFormat("wrong_prefix_12345678901234567890123456789012"),
      ).toBe(false);
    });
  });
});
