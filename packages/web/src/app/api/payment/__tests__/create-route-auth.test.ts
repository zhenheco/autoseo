import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@shared/supabase", () => ({
  createClient: vi.fn(),
}));

describe("payment create route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["onetime", "../onetime/create/route"],
    ["recurring", "../recurring/create/route"],
  ])("marks %s payment creation as authenticated", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
  });
});
