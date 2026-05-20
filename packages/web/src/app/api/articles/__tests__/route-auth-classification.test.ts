import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

const authMiddleware = vi.hoisted(() => ({
  withAuth: vi.fn((handler) => handler),
  withCompany: vi.fn((handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/api/auth-middleware", () => authMiddleware);

vi.mock("@/lib/agents/orchestrator", () => ({
  ParallelOrchestrator: vi.fn(),
}));

vi.mock("@/lib/openrouter/client", () => ({
  getOpenRouterClient: vi.fn(),
}));

vi.mock("@/lib/ai/api-router", () => ({
  getAPIRouter: vi.fn(),
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

vi.mock("@/lib/billing/article-quota-service", () => ({
  ArticleQuotaService: vi.fn(),
}));

describe("article route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["continue", "../continue/route", "authenticated"],
    ["preview titles", "../preview-titles/route", "authenticated"],
    ["generate titles", "../generate-titles/route", "company"],
    ["article list", "../route", "company"],
    ["article edit/delete", "../[id]/route", "company"],
    ["article publish", "../[id]/publish/route", "company"],
    ["article details", "../[id]/details/route", "company"],
    ["article schedule", "../[id]/schedule/route", "company"],
    ["article cancel", "../[id]/cancel/route", "company"],
    ["article jobs list", "../jobs/route", "company"],
    ["article job delete", "../jobs/[id]/route", "company"],
  ])("marks %s route as %s", async (_name, routePath, mode) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      mode,
      expect.any(Function),
    );
  });
});
