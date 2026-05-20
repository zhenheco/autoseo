import { beforeEach, describe, expect, it, vi } from "vitest";

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

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
            supabase: { from: vi.fn() },
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
    shopHandle: "demo-store",
    accessToken: "token",
    grantedScopes: ["read_products", "read_content"],
  })),
}));

const scopeResolver = vi.hoisted(() => ({
  getGrantedScopes: vi.fn(async () => ["read_products", "read_content"]),
}));

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const shoplineClientState = vi.hoisted(() => ({
  getProduct: vi.fn(),
  getCollection: vi.fn(),
  getShop: vi.fn(),
}));

const shoplineClient = vi.hoisted(() => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return shoplineClientState;
  }),
}));

const generator = vi.hoisted(() => ({
  generateShoplineSeoDraft: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/client", () => shoplineClient);
vi.mock("@/lib/shopline/ai-seo-generator", () => generator);
vi.mock("@/lib/shopline/ai-seo-call-model", () => ({
  callShoplineAiSeoModel: vi.fn(),
}));

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

describe("POST /api/shopline/[websiteId]/ai-seo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    adminState.website = { id: "website-1" };
    scopeResolver.getGrantedScopes.mockResolvedValue([
      "read_products",
      "read_content",
    ]);
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    shoplineClientState.getShop.mockResolvedValue({
      id: 1,
      name: "Summit Store",
      domain: "example.com",
      myshopline_domain: "demo-store.myshopline.com",
    });
    shoplineClientState.getProduct.mockResolvedValue({
      id: "product-1",
      title: "Trail Jacket",
      handle: "trail-jacket",
      product_type: "Outerwear",
      vendor: "Summit Co",
      tags: "running",
      images: [
        {
          id: "image-1",
          src: "https://img.myshopline.com/image.jpg",
          alt: "",
          position: 1,
        },
      ],
      variants: [],
      created_at: "2026-05-19T00:00:00.000Z",
      updated_at: "2026-05-19T00:00:00.000Z",
      seo: { description: "Waterproof jacket" },
    });
    shoplineClientState.getCollection.mockResolvedValue({
      id: "collection-1",
      title: "Trail Gear",
      handle: "trail-gear",
      body_html: "Mountain running essentials",
      seo: {},
    });
    generator.generateShoplineSeoDraft.mockResolvedValue({
      drafts: {
        seoTitle: "Trail Jacket | Summit Store",
        seoDescription: "Waterproof trail jacket for mountain runners.",
      },
      model: "deepseek-chat",
      generatedAt: "2026-05-19T18:00:00.000Z",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          entityId: "product-1",
          fields: ["seoTitle"],
        }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(401);
    expect(generator.generateShoplineSeoDraft).not.toHaveBeenCalled();
  });

  it("returns 403 when the company does not own the website", async () => {
    adminState.website = null;
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          entityId: "product-1",
          fields: ["seoTitle"],
        }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(rateLimiter.checkShoplineWriteRateLimit).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid bodies and image requests without productId", async () => {
    const { POST } = await import("../route");

    const invalidFieldsResponse = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          entityId: "product-1",
          fields: [],
        }),
      }) as never,
      params(),
    );
    expect(invalidFieldsResponse.status).toBe(400);

    const imageWithoutProductResponse = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "image",
          entityId: "image-1",
          fields: ["alt"],
        }),
      }) as never,
      params(),
    );

    expect(imageWithoutProductResponse.status).toBe(400);
    expect(generator.generateShoplineSeoDraft).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the company write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          entityId: "product-1",
          fields: ["seoTitle"],
        }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(generator.generateShoplineSeoDraft).not.toHaveBeenCalled();
  });

  it("generates a product SEO draft without writing to SHOPLINE", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          entityId: "product-1",
          fields: ["seoTitle", "seoDescription"],
        }),
      }) as never,
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(shoplineClient.ShoplineClient).toHaveBeenCalledWith({
      shopHandle: "demo-store",
      accessToken: "token",
    });
    expect(shoplineClientState.getProduct).toHaveBeenCalledWith("product-1");
    expect(generator.generateShoplineSeoDraft).toHaveBeenCalledWith(
      {
        entityType: "product",
        entity: {
          title: "Trail Jacket",
          handle: "trail-jacket",
          type: "Outerwear",
          vendor: "Summit Co",
          tags: "running",
          description: "Waterproof jacket",
        },
        shop: { name: "Summit Store" },
        fields: ["seoTitle", "seoDescription"],
      },
      expect.any(Object),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      drafts: {
        seoTitle: "Trail Jacket | Summit Store",
        seoDescription: "Waterproof trail jacket for mountain runners.",
      },
      model: "deepseek-chat",
      generatedAt: "2026-05-19T18:00:00.000Z",
    });
  });

  it("generates an image alt draft using productId and imageId", async () => {
    generator.generateShoplineSeoDraft.mockResolvedValueOnce({
      drafts: { alt: "Trail jacket on a rocky mountain path" },
      model: "deepseek-chat",
      generatedAt: "2026-05-19T18:00:00.000Z",
    });
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/ai-seo", {
        method: "POST",
        body: JSON.stringify({
          entityType: "image",
          entityId: "image-1",
          productId: "product-1",
          fields: ["alt"],
        }),
      }) as never,
      params(),
    );

    expect(generator.generateShoplineSeoDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "image",
        entity: expect.objectContaining({
          title: "Trail Jacket",
          type: "Outerwear",
          vendor: "Summit Co",
          tags: "running",
          description: "Waterproof jacket",
          position: 1,
        }),
        fields: ["alt"],
      }),
      expect.any(Object),
    );
    expect(response.status).toBe(200);
  });
});
