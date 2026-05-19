import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/openrouter/client", () => ({
  getOpenRouterClient: vi.fn(),
}));

vi.mock("@/lib/cloudflare/ai-gateway", () => ({
  buildGeminiApiUrl: vi.fn(),
  buildGeminiHeaders: vi.fn(),
  isGatewayEnabled: vi.fn(),
}));

vi.mock("@/lib/cache/title-templates", () => ({
  getTitlesFromTemplates: vi.fn(),
}));

describe("preview titles JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("../preview-titles/route");

    const response = await POST({
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns 400 for empty body", async () => {
    const { POST } = await import("../preview-titles/route");

    const response = await POST(
      new Request("https://example.com/api/articles/preview-titles", {
        method: "POST",
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });
});
