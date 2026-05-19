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
            { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
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
  resolveShoplineAccessToken: vi.fn(async () => ({
    shopHandle: "demo-shop",
    accessToken: "token-123",
    grantedScopes: ["read_products"],
  })),
}));

const listProductCollects = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return { listProductCollects };
  }),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/client", () => client);

function params(websiteId = "website-1", productId = "product-1") {
  return {
    params: Promise.resolve({ websiteId, productId }),
  };
}

describe("GET /api/shopline/[websiteId]/products/[productId]/collects", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    adminState.website = { id: "website-1" };
    connections.resolveShoplineAccessToken.mockResolvedValue({
      shopHandle: "demo-shop",
      accessToken: "token-123",
      grantedScopes: ["read_products"],
    });
    listProductCollects.mockResolvedValue({
      collects: [
        {
          id: "collect-1",
          collection_id: "collection-1",
          product_id: "product-1",
        },
      ],
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/collects",
      ) as never,
      params(),
    );

    expect(response.status).toBe(401);
  });

  it("returns 403 when the company does not own the website", async () => {
    adminState.website = null;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/collects",
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    expect(listProductCollects).not.toHaveBeenCalled();
  });

  it("returns product collects for an owned website", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/collects",
      ) as never,
      params(),
    );

    expect(client.ShoplineClient).toHaveBeenCalledWith({
      shopHandle: "demo-shop",
      accessToken: "token-123",
    });
    expect(listProductCollects).toHaveBeenCalledWith("product-1");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collects: [
        {
          id: "collect-1",
          collection_id: "collection-1",
          product_id: "product-1",
        },
      ],
    });
  });

  it("maps SHOPLINE auth errors to 502 with reauthorize_url", async () => {
    listProductCollects.mockRejectedValueOnce(new ShoplineAuthError());
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/collects",
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
