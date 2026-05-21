import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/api/auth-middleware", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/api/auth-middleware")
  >("@/lib/api/auth-middleware");
  return {
    ...actual,
    extractPathParams: vi.fn(() => ({ id: "company-1" })),
  };
});

describe("company route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["company create", "../route"],
    ["company delete", "../[id]/route"],
  ])("marks %s as authenticated", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
  });
});
