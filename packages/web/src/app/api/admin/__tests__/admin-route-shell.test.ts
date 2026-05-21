import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/admin/admin-service", () => ({
  getAdminActionLogs: vi.fn(),
  getAllSubscriptions: vi.fn(),
  extendSubscription: vi.fn(),
  grantArticles: vi.fn(),
}));

vi.mock("@/lib/admin/promo-code-service", () => ({
  getAllPromoCodes: vi.fn(),
  createPromoCode: vi.fn(),
  getPromoCode: vi.fn(),
  updatePromoCode: vi.fn(),
  deactivatePromoCode: vi.fn(),
  getPromoCodeUsages: vi.fn(),
}));

describe("admin route shell classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["admin logs", "../logs/route"],
    ["admin promo codes", "../promo-codes/route"],
    ["admin promo code detail", "../promo-codes/[id]/route"],
    ["admin refunds", "../refunds/route"],
    ["admin refund reject", "../refunds/[id]/reject/route"],
    ["admin subscriptions", "../subscriptions/route"],
    ["admin subscription extend", "../subscriptions/[companyId]/extend/route"],
    [
      "admin subscription grant articles",
      "../subscriptions/[companyId]/grant-articles/route",
    ],
  ])("marks %s as admin", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "admin",
      expect.any(Function),
    );
  });
});
