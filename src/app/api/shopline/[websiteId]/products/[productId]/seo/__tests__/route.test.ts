import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineAuthError } from "@/lib/shopline/types";

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

const authState = vi.hoisted(() => ({
  authenticated: true,
  supabase: { from: vi.fn() },
}));

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (_mode, handler) =>
      async (request: Request, ...args: unknown[]) => {
        if (!authState.authenticated) {
          const { NextResponse } = await import("next/server");
          return NextResponse.json(
            {
              success: false,
              error: "Unauthorized",
              code: "UNAUTHORIZED",
            },
            { status: 401 },
          );
        }

        return handler(
          request,
          {
            authMode: "company",
            companyId: "company-1",
            user: { id: "user-1" },
            supabase: authState.supabase,
          },
          ...args,
        );
      },
  ),
}));

const adminState = vi.hoisted(() => ({
  website: { id: "website-1" } as { id: string } | null,
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from(table: string) {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        maybeSingle: async () => ({
          data: table === "website_configs" ? adminState.website : null,
          error: null,
        }),
      };
      return builder;
    },
  })),
}));

const connections = vi.hoisted(() => ({
  createSupabaseShoplineConnectionStore: vi.fn(() => ({ store: true })),
}));

const scopeResolver = vi.hoisted(() => ({
  getGrantedScopes: vi.fn(async () => ["read_products", "write_products"]),
}));

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const seoUpdater = vi.hoisted(() => ({
  updateShoplineProductSeo: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/seo-updater", () => seoUpdater);

function params(websiteId = "website-1", productId = "product-1") {
  return {
    params: Promise.resolve({ websiteId, productId }),
  };
}

describe("PATCH /api/shopline/[websiteId]/products/[productId]/seo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    scopeResolver.getGrantedScopes.mockResolvedValue([
      "read_products",
      "write_products",
    ]);
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    seoUpdater.updateShoplineProductSeo.mockResolvedValue({
      id: "product-1",
      title: "Product 1",
      handle: "product-1",
      seo: { title: "Updated SEO title" },
    });
  });

  it("returns 400 for malformed JSON using the standard shape", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      {
        url: "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as never,
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: "Unauthorized",
    });
  });

  it("returns 403 when the company does not own the website", async () => {
    adminState.website = null;
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(seoUpdater.updateShoplineProductSeo).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the company write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: "shopline_rate_limited",
      retryAfter: 17,
    });
    expect(scopeResolver.getGrantedScopes).not.toHaveBeenCalled();
    expect(seoUpdater.updateShoplineProductSeo).not.toHaveBeenCalled();
  });

  it("returns 403 with missing_scopes when the connection lacks write_products", async () => {
    scopeResolver.getGrantedScopes.mockResolvedValueOnce(["read_products"]);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_scope_missing",
      missing_scopes: ["write_products"],
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
    expect(seoUpdater.updateShoplineProductSeo).not.toHaveBeenCalled();
  });

  it("updates product SEO and returns the updated product", async () => {
    const updatedProduct = {
      id: "product-1",
      title: "Product 1",
      handle: "product-1",
      seo: { title: "Updated SEO title" },
    };
    seoUpdater.updateShoplineProductSeo.mockResolvedValueOnce(updatedProduct);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(rateLimiter.checkShoplineWriteRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      "company-1",
    );
    expect(scopeResolver.getGrantedScopes).toHaveBeenCalledWith(
      { store: true },
      {
        companyId: "company-1",
        websiteId: "website-1",
      },
    );
    expect(seoUpdater.updateShoplineProductSeo).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "product-1",
      { seo: { title: "Updated SEO title" }, source: "ui" },
      expect.objectContaining({ store: { store: true } }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updatedProduct);
  });

  it("passes UI audit options with the authenticated user id", async () => {
    const { PATCH } = await import("../route");

    await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(seoUpdater.updateShoplineProductSeo).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "product-1",
      { seo: { title: "Updated SEO title" }, source: "ui" },
      {
        store: { store: true },
        auditOptions: {
          supabase: authState.supabase,
          userId: "user-1",
          source: "ui",
        },
      },
    );
  });

  it("maps SHOPLINE 401 errors to shopline_auth_invalid with reauthorize_url", async () => {
    seoUpdater.updateShoplineProductSeo.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ seo: { title: "Updated SEO title" } }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_auth_invalid",
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });
});
