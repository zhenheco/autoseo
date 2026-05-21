import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
  extendSubscription: vi.fn(),
  grantArticles: vi.fn(),
  createPromoCode: vi.fn(),
  updatePromoCode: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => ({
  withRouteAuth: vi.fn(
    (_mode, handler) =>
      (request: Request, ...args: unknown[]) =>
        handler(
          request,
          { user: { id: "admin-1", email: "admin@example.com" } },
          ...args,
        ),
  ),
}));

vi.mock("@/lib/admin/admin-service", () => ({
  extendSubscription: services.extendSubscription,
  grantArticles: services.grantArticles,
}));

vi.mock("@/lib/admin/promo-code-service", () => ({
  createPromoCode: services.createPromoCode,
  updatePromoCode: services.updatePromoCode,
  getAllPromoCodes: vi.fn(),
  getPromoCode: vi.fn(),
  deactivatePromoCode: vi.fn(),
  getPromoCodeUsages: vi.fn(),
}));

describe("admin mutation JSON parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it.each([
    [
      "promo code create",
      "../promo-codes/route",
      "POST",
      "https://example.com/api/admin/promo-codes",
      undefined,
      services.createPromoCode,
    ],
    [
      "promo code update",
      "../promo-codes/[id]/route",
      "PATCH",
      "https://example.com/api/admin/promo-codes/promo-1",
      { params: Promise.resolve({ id: "promo-1" }) },
      services.updatePromoCode,
    ],
    [
      "subscription extend",
      "../subscriptions/[companyId]/extend/route",
      "POST",
      "https://example.com/api/admin/subscriptions/company-1/extend",
      { params: Promise.resolve({ companyId: "company-1" }) },
      services.extendSubscription,
    ],
    [
      "subscription grant articles",
      "../subscriptions/[companyId]/grant-articles/route",
      "POST",
      "https://example.com/api/admin/subscriptions/company-1/grant-articles",
      { params: Promise.resolve({ companyId: "company-1" }) },
      services.grantArticles,
    ],
  ])(
    "returns 400 for malformed %s body",
    async (_name, routePath, method, url, contextArg, serviceSpy) => {
      const route = await import(routePath);

      const response = await route[method](
        new Request(url, {
          method,
          body: "{",
        }) as never,
        contextArg as never,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Request body must be valid JSON",
        code: "INVALID_JSON",
      });
      expect(serviceSpy).not.toHaveBeenCalled();
    },
  );
});
