import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

const authMiddleware = vi.hoisted(() => ({
  withAuth: vi.fn((handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/api/auth-middleware", () => authMiddleware);

describe("translation child route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("marks translation article summaries as authenticated", async () => {
    await import("../articles/route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
  });

  it("marks translation settings reads and writes as authenticated", async () => {
    await import("../settings/route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
    expect(routeAuth.withRouteAuth).toHaveBeenCalledTimes(2);
  });
});
