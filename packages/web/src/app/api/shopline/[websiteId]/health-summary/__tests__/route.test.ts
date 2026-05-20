import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
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

const productFetcher = vi.hoisted(() => ({
  fetchShoplineProducts: vi.fn(),
}));

const collectionFetcher = vi.hoisted(() => ({
  fetchShoplineCollections: vi.fn(),
}));

const kvState = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  get: vi.fn(async (key: string) => kvState.store.get(key) ?? null),
  put: vi.fn(async (key: string, value: string) => {
    kvState.store.set(key, JSON.parse(value));
  }),
}));

const cloudflare = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(() => ({
    env: {
      CACHE_KV: {
        get: kvState.get,
        put: kvState.put,
      },
    },
  })),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@shared/supabase", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/product-fetcher", () => productFetcher);
vi.mock("@/lib/shopline/collection-fetcher", () => collectionFetcher);
vi.mock("@opennextjs/cloudflare", () => cloudflare);

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

describe("GET /api/shopline/[websiteId]/health-summary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    adminState.website = { id: "website-1" };
    kvState.store.clear();
    productFetcher.fetchShoplineProducts.mockResolvedValue({
      products: [],
      nextCursor: undefined,
    });
    collectionFetcher.fetchShoplineCollections.mockResolvedValue({
      collections: [],
      nextCursor: null,
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest(
        "https://1wayseo.com/api/shopline/website-1/health-summary",
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
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest(
        "https://1wayseo.com/api/shopline/website-1/health-summary",
      ),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(productFetcher.fetchShoplineProducts).not.toHaveBeenCalled();
    expect(collectionFetcher.fetchShoplineCollections).not.toHaveBeenCalled();
  });

  it("returns a cached health summary with X-Cache HIT", async () => {
    kvState.store.set("shopline:health:website-1", {
      counts: {
        missingSeoTitle: 1,
        seoTitleTooLong: 2,
        missingSeoDescription: 3,
        seoDescriptionTooLong: 4,
        missingAlt: 5,
        duplicateTitle: 6,
      },
    });
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest(
        "https://1wayseo.com/api/shopline/website-1/health-summary",
      ),
      params(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Cache")).toBe("HIT");
    expect(productFetcher.fetchShoplineProducts).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      counts: {
        missingSeoTitle: 1,
        seoTitleTooLong: 2,
        missingSeoDescription: 3,
        seoDescriptionTooLong: 4,
        missingAlt: 5,
        duplicateTitle: 6,
      },
    });
  });

  it("fetches first-page products and collections, aggregates counts, and caches the result", async () => {
    productFetcher.fetchShoplineProducts.mockResolvedValueOnce({
      products: [
        {
          id: "product-1",
          title: "Duplicate title",
          seo: { title: "", description: "d".repeat(161) },
          images: [{ id: "image-1", alt: "" }],
        },
        {
          id: "product-2",
          title: "Long title product",
          seo: { title: "t".repeat(71), description: "" },
          images: [{ id: "image-2", alt: "Hero" }],
        },
      ],
      nextCursor: "ignored-next",
    });
    collectionFetcher.fetchShoplineCollections.mockResolvedValueOnce({
      collections: [
        {
          id: "collection-1",
          title: "Duplicate title",
          seo: { title: "Collection SEO", description: "Collection desc" },
        },
      ],
      nextCursor: "ignored-next",
    });
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest(
        "https://1wayseo.com/api/shopline/website-1/health-summary",
      ),
      params(),
    );

    expect(productFetcher.fetchShoplineProducts).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      undefined,
      { store: { store: true } },
    );
    expect(collectionFetcher.fetchShoplineCollections).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      null,
      { store: { store: true } },
    );
    expect(kvState.put).toHaveBeenCalledWith(
      "shopline:health:website-1",
      expect.any(String),
      { expirationTtl: 300 },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Cache")).toBe("MISS");
    await expect(response.json()).resolves.toEqual({
      counts: {
        missingSeoTitle: 1,
        seoTitleTooLong: 1,
        missingSeoDescription: 1,
        seoDescriptionTooLong: 1,
        missingAlt: 1,
        duplicateTitle: 2,
      },
    });
  });

  it("maps SHOPLINE auth errors to shopline_auth_invalid with reauthorize_url", async () => {
    productFetcher.fetchShoplineProducts.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { GET } = await import("../route");

    const response = await GET(
      new NextRequest(
        "https://1wayseo.com/api/shopline/website-1/health-summary",
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
