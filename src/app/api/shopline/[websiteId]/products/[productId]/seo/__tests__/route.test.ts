import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineAuthError } from "@/lib/shopline/types";

const authState = vi.hoisted(() => ({
  authenticated: true,
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
            supabase: {},
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

const seoUpdater = vi.hoisted(() => ({
  updateShoplineProductSeo: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
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
    adminState.website = { id: "website-1" };
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
      ),
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
      ),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
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
      ),
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(seoUpdater.updateShoplineProductSeo).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "product-1",
      { seo: { title: "Updated SEO title" }, source: "ui" },
      { store: { store: true } },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updatedProduct);
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
      ),
      params(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_auth_invalid",
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });
});
