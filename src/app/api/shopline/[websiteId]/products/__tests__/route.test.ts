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
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          adminState.calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          adminState.calls.push({ table, method: "eq", args });
          return builder;
        },
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

const productFetcher = vi.hoisted(() => ({
  fetchShoplineProducts: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/product-fetcher", () => productFetcher);

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

describe("GET /api/shopline/[websiteId]/products", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    adminState.website = { id: "website-1" };
    adminState.calls = [];
    productFetcher.fetchShoplineProducts.mockResolvedValue({
      products: [],
      nextCursor: undefined,
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products",
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
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products",
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(productFetcher.fetchShoplineProducts).not.toHaveBeenCalled();
  });

  it("returns shopline_no_connection when no SHOPLINE connection exists", async () => {
    productFetcher.fetchShoplineProducts.mockRejectedValueOnce(
      new Error("shopline_no_connection"),
    );
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products",
      ) as never,
      params(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_no_connection",
    });
  });

  it("maps SHOPLINE 401 errors to shopline_auth_invalid with reauthorize_url", async () => {
    productFetcher.fetchShoplineProducts.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products",
      ) as never,
      params(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_auth_invalid",
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });

  it("returns products and nextCursor for a connected website", async () => {
    const products = [
      {
        id: "product-1",
        title: "Product 1",
        handle: "product-1",
        seo: { title: "SEO title" },
      },
    ];
    productFetcher.fetchShoplineProducts.mockResolvedValueOnce({
      products,
      nextCursor: "cursor-next",
    });
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products?cursor=cursor-1",
      ) as never,
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(adminState.calls).toContainEqual({
      table: "website_configs",
      method: "eq",
      args: ["company_id", "company-1"],
    });
    expect(productFetcher.fetchShoplineProducts).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "cursor-1",
      { store: { store: true } },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      products,
      nextCursor: "cursor-next",
    });
  });
});
