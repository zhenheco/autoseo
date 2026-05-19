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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/wordpress/client", () => ({
  WordPressClient: vi.fn(),
}));

vi.mock("@/lib/security/token-encryption", () => ({
  decryptWordPressPassword: vi.fn(),
  isEncrypted: vi.fn(),
}));

vi.mock("@/lib/brevo", () => ({
  syncCompanyOwnerToBrevo: vi.fn(),
}));

vi.mock("@/lib/sitemap/ping-service", () => ({
  pingAllSearchEngines: vi.fn(),
}));

vi.mock("@/lib/sync", () => ({
  syncArticle: vi.fn(),
}));

describe("article management JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "article update",
      "../[id]/route",
      "PATCH",
      "https://example.com/api/articles/123",
    ],
    [
      "article publish",
      "../[id]/publish/route",
      "POST",
      "https://example.com/api/articles/123/publish",
    ],
    [
      "article schedule",
      "../[id]/schedule/route",
      "POST",
      "https://example.com/api/articles/123/schedule",
    ],
  ])(
    "returns 400 for malformed %s JSON",
    async (_name, routePath, method, url) => {
      const route = await import(routePath);

      const response = await route[method]({
        url,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as never);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Request body must be valid JSON",
        code: "INVALID_JSON",
      });
    },
  );

  it.each([
    [
      "article update",
      "../[id]/route",
      "PATCH",
      "https://example.com/api/articles/123",
    ],
    [
      "article publish",
      "../[id]/publish/route",
      "POST",
      "https://example.com/api/articles/123/publish",
    ],
    [
      "article schedule",
      "../[id]/schedule/route",
      "POST",
      "https://example.com/api/articles/123/schedule",
    ],
  ])("returns 400 for empty %s body", async (_name, routePath, method, url) => {
    const route = await import(routePath);

    const response = await route[method](
      new Request(url, {
        method,
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });
});
