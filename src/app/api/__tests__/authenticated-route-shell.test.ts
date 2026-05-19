import { beforeEach, describe, expect, it, vi } from "vitest";

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn((_mode, handler) => handler),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

vi.mock("@/lib/billing/token-billing-service", () => ({
  TokenBillingService: vi.fn(),
}));

vi.mock("@/lib/payment/refund-service", () => ({
  RefundService: {
    createInstance: vi.fn(),
  },
}));

vi.mock("@/lib/billing/article-quota-service", () => ({
  ArticleQuotaService: vi.fn(),
}));

vi.mock("@/lib/admin/promo-code-service", () => ({
  validatePromoCode: vi.fn(),
}));

vi.mock("@/lib/services/slug-generator", () => ({
  generateAndEnsureUniqueSlug: vi.fn(),
  assemblePublishURL: vi.fn(),
}));

describe("authenticated route shell classification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    ["article quota", "../article-quota/route"],
    ["article batch publish", "../articles/batch-publish/route"],
    ["article import batch", "../articles/import-batch/route"],
    [
      "article schedule batch publish",
      "../articles/schedule-batch-publish/route",
    ],
    ["billing balance", "../billing/balance/route"],
    ["payment order status", "../payment/order-status/[orderNo]/route"],
    ["promo code validation", "../promo-codes/validate/route"],
    ["refund status", "../refund/[refundNo]/status/route"],
    ["refund orders", "../refund/orders/route"],
    ["user profile", "../user/profile/route"],
  ])("marks %s as authenticated", async (_name, routePath) => {
    await import(routePath);

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "authenticated",
      expect.any(Function),
    );
  });
});
