import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/payment/payment-service", () => ({
  PaymentService: {
    createInstance: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
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
