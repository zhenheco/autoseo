import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

describe("public blog route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["article list", "../articles/route"],
    ["article detail", "../articles/[slug]/route"],
    ["categories", "../categories/route"],
    ["tags", "../tags/route"],
  ])("marks %s GET as public-read", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "public-read",
      expect.any(Function),
    );
  });

  it("marks view counter POST as public", async () => {
    await import("../views/route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "public",
      expect.any(Function),
    );
  });
});
