import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

describe("AI model route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("marks model listing as public-read and model writes as authenticated", async () => {
    await import("../route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "public-read",
      expect.any(Function),
    );
    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
  });

  it.each([
    ["text models", "../text/route"],
    ["image models", "../image/route"],
  ])("marks %s as public-read", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "public-read",
      expect.any(Function),
    );
  });

  it.each([
    ["model stats", "../stats/route"],
    ["company preferences", "../company-preferences/route"],
  ])("marks %s as company scoped", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
  });
});
