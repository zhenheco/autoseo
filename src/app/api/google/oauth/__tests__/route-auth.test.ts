import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
  })),
}));

vi.mock("@/lib/security/token-encryption", () => ({
  decryptToken: vi.fn(),
  encryptToken: vi.fn(),
  fetchGoogleUserInfo: vi.fn(),
  refreshGoogleToken: vi.fn(),
  revokeGoogleToken: vi.fn(),
}));

describe("Google OAuth route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["authorize", "../authorize/route", "authenticated"],
    ["callback", "../callback/route", "public"],
    ["refresh", "../refresh/route", "authenticated"],
    ["revoke", "../revoke/route", "authenticated"],
  ])("marks %s as %s", async (_name, routePath, mode) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      mode,
      expect.any(Function),
    );
  });
});
