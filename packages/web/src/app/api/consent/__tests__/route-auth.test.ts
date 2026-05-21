import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(),
}));

describe("consent route auth classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("marks cookie consent writes as public", async () => {
    await import("../route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "public",
      expect.any(Function),
    );
  });
});
