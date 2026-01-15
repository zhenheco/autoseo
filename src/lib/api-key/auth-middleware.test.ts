/**
 * API 認證 Middleware 測試
 *
 * TDD Step 3: 🔴 撰寫失敗測試
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock validateApiKey
vi.mock("./api-key-service", () => ({
  validateApiKey: vi.fn(),
}));

describe("API 認證 Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("withApiKeyAuth", () => {
    test("有效 Authorization header 應該通過驗證", async () => {
      const { validateApiKey } = await import("./api-key-service");
      const { withApiKeyAuth } = await import("./auth-middleware");

      // Mock 返回有效的網站資訊
      vi.mocked(validateApiKey).mockResolvedValue({
        id: "website-123",
        company_id: "company-456",
        website_name: "Test Site",
        wordpress_url: null,
        site_type: "external",
        is_external_site: true,
      });

      // 建立 mock request
      const request = new NextRequest(
        "http://localhost/api/v1/sites/articles",
        {
          headers: {
            Authorization: "Bearer sk_site_12345678901234567890123456789012",
          },
        },
      );

      // 建立 mock handler
      const handler = vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: true }), { status: 200 }),
        );

      const wrappedHandler = withApiKeyAuth(handler);
      const response = await wrappedHandler(request);

      expect(response.status).toBe(200);
      expect(handler).toHaveBeenCalled();

      // 確認 handler 收到了 website 資訊
      const callArgs = handler.mock.calls[0];
      expect(callArgs[1]).toEqual({
        id: "website-123",
        company_id: "company-456",
        website_name: "Test Site",
        wordpress_url: null,
        site_type: "external",
        is_external_site: true,
      });
    });

    test("缺少 Authorization header 應該返回 401", async () => {
      const { withApiKeyAuth } = await import("./auth-middleware");

      const request = new NextRequest("http://localhost/api/v1/sites/articles");

      const handler = vi.fn();
      const wrappedHandler = withApiKeyAuth(handler);
      const response = await wrappedHandler(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body.error).toBe("Missing authorization header");
    });

    test("無效的 Authorization 格式應該返回 401", async () => {
      const { withApiKeyAuth } = await import("./auth-middleware");

      const request = new NextRequest(
        "http://localhost/api/v1/sites/articles",
        {
          headers: {
            Authorization: "InvalidFormat",
          },
        },
      );

      const handler = vi.fn();
      const wrappedHandler = withApiKeyAuth(handler);
      const response = await wrappedHandler(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body.error).toBe("Invalid authorization format");
    });

    test("無效的 API Key 應該返回 401", async () => {
      const { validateApiKey } = await import("./api-key-service");
      const { withApiKeyAuth } = await import("./auth-middleware");

      // Mock 返回 null（驗證失敗）
      vi.mocked(validateApiKey).mockResolvedValue(null);

      const request = new NextRequest(
        "http://localhost/api/v1/sites/articles",
        {
          headers: {
            Authorization: "Bearer sk_site_invalid_key_here_1234567890",
          },
        },
      );

      const handler = vi.fn();
      const wrappedHandler = withApiKeyAuth(handler);
      const response = await wrappedHandler(request);

      expect(response.status).toBe(401);
      expect(handler).not.toHaveBeenCalled();

      const body = await response.json();
      expect(body.error).toBe("Invalid API key");
    });
  });

  describe("extractBearerToken", () => {
    test("正確的 Bearer token 應該被提取", async () => {
      const { extractBearerToken } = await import("./auth-middleware");

      expect(extractBearerToken("Bearer sk_site_abc123")).toBe(
        "sk_site_abc123",
      );
      expect(extractBearerToken("Bearer   sk_site_abc123")).toBe(
        "sk_site_abc123",
      );
    });

    test("錯誤格式應該返回 null", async () => {
      const { extractBearerToken } = await import("./auth-middleware");

      expect(extractBearerToken("")).toBeNull();
      expect(extractBearerToken("Basic abc123")).toBeNull();
      expect(extractBearerToken("sk_site_abc123")).toBeNull();
      expect(extractBearerToken("Bearer")).toBeNull();
    });
  });

  describe("createErrorResponse", () => {
    test("應該返回正確格式的錯誤回應", async () => {
      const { createErrorResponse } = await import("./auth-middleware");

      const response = createErrorResponse("Test error", 400);

      expect(response.status).toBe(400);
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = await response.json();
      expect(body.error).toBe("Test error");
      expect(body.success).toBe(false);
    });
  });
});
