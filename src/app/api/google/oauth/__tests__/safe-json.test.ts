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

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/security/token-encryption", () => ({
  decryptToken: vi.fn(),
  encryptToken: vi.fn(),
  refreshGoogleToken: vi.fn(),
  revokeGoogleToken: vi.fn(),
}));

describe("Google OAuth JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "refresh",
      "../refresh/route",
      "https://example.com/api/google/oauth/refresh",
    ],
    [
      "revoke",
      "../revoke/route",
      "https://example.com/api/google/oauth/revoke",
    ],
  ])("returns 400 for empty %s body", async (_name, routePath, url) => {
    const { POST } = await import(routePath);

    const response = await POST(
      new Request(url, {
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
