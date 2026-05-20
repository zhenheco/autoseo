import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "company",
        companyId: "company-1",
        user: { id: "user-1" },
        supabase: {},
      }),
  ),
}));

vi.mock("@/lib/ai/api-router", () => ({
  getAPIRouter: vi.fn(),
}));

vi.mock("@/lib/openrouter/client", () => ({
  getOpenRouterClient: vi.fn(),
}));

vi.mock("@/lib/cache/title-cache", () => ({
  getTitlesFromCache: vi.fn(),
  saveTitlesToCache: vi.fn(),
}));

vi.mock("@/lib/cache/title-templates", () => ({
  getTitlesFromTemplates: vi.fn(),
}));

vi.mock("@shared/ai-gateway", () => ({
  buildGeminiApiUrl: vi.fn(),
  buildGeminiHeaders: vi.fn(),
  isGatewayEnabled: vi.fn(),
}));

describe("generate titles JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 400 for malformed JSON", async () => {
    const { POST } = await import("../generate-titles/route");

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
    const { POST } = await import("../generate-titles/route");

    const response = await POST(
      new Request("https://example.com/api/articles/generate-titles", {
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
