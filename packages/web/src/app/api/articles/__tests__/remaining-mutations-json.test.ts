import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn(
    (_mode, handler) => (request: Request) =>
      handler(request, {
        authMode: "authenticated",
        user: { id: "user-1" },
        supabase: {},
      }),
  ),
}));

vi.mock("@/lib/agents/orchestrator", () => ({
  ParallelOrchestrator: vi.fn(),
}));

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/sync", () => ({
  syncArticle: vi.fn(),
}));

describe("remaining article mutation JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("RESYNC_API_SECRET", "test-secret");
  });

  it.each([
    [
      "continue",
      "../continue/route",
      "https://example.com/api/articles/continue",
      {},
    ],
    [
      "trigger github",
      "../trigger-github/route",
      "https://example.com/api/articles/trigger-github",
      {},
    ],
    [
      "resync",
      "../resync/route",
      "https://example.com/api/articles/resync",
      { "x-resync-secret": "test-secret" },
    ],
  ])(
    "returns 400 for empty %s body",
    async (_name, routePath, url, headers) => {
      const { POST } = await import(routePath);

      const response = await POST(
        new Request(url, {
          method: "POST",
          headers,
        }) as never,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Request body must be valid JSON",
        code: "INVALID_JSON",
      });
    },
  );
});
