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

const imageAltUpdater = vi.hoisted(() => ({
  updateShoplineImageAlt: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/image-alt-updater", () => imageAltUpdater);

function params(
  websiteId = "website-1",
  productId = "product-1",
  imageId = "image-1",
) {
  return {
    params: Promise.resolve({ websiteId, productId, imageId }),
  };
}

describe("PATCH /api/shopline/[websiteId]/products/[productId]/images/[imageId]/alt", () => {
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
    imageAltUpdater.updateShoplineImageAlt.mockResolvedValue({
      id: "image-1",
      src: "https://img.myshopline.com/example.jpg",
      alt: "Updated alt",
      position: 1,
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "Updated alt" }),
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
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "Updated alt" }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(imageAltUpdater.updateShoplineImageAlt).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON and alt values over 125 characters", async () => {
    const { PATCH } = await import("../route");

    const malformedResponse = await PATCH(
      {
        url: "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as never,
      params(),
    );

    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toEqual({
      error: "Request body must be valid JSON",
      code: "INVALID_JSON",
    });

    const tooLongResponse = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "x".repeat(126) }),
        },
      ) as never,
      params(),
    );

    expect(tooLongResponse.status).toBe(400);
    await expect(tooLongResponse.json()).resolves.toMatchObject({
      error: "Invalid request body",
    });
    expect(imageAltUpdater.updateShoplineImageAlt).not.toHaveBeenCalled();
  });

  it("returns 403 with missing_scopes when the connection lacks write_products", async () => {
    scopeResolver.getGrantedScopes.mockResolvedValueOnce(["read_products"]);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "Updated alt" }),
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
    expect(imageAltUpdater.updateShoplineImageAlt).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the company write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "Updated alt" }),
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
    expect(imageAltUpdater.updateShoplineImageAlt).not.toHaveBeenCalled();
  });

  it("maps SHOPLINE auth errors to 502 with reauthorize_url", async () => {
    imageAltUpdater.updateShoplineImageAlt.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "Updated alt" }),
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

  it("updates image alt and returns the updated image", async () => {
    const updatedImage = {
      id: "image-1",
      src: "https://img.myshopline.com/example.jpg",
      alt: "Updated alt",
      position: 1,
    };
    imageAltUpdater.updateShoplineImageAlt.mockResolvedValueOnce(updatedImage);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({ alt: "Updated alt" }),
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
    expect(imageAltUpdater.updateShoplineImageAlt).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "product-1",
      "image-1",
      "Updated alt",
      {
        store: { store: true },
        auditOptions: {
          supabase: authState.supabase,
          userId: "user-1",
          source: "ui",
        },
      },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updatedImage);
  });

  it("passes AI source and model to image alt audit options", async () => {
    const { PATCH } = await import("../route");

    await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/products/product-1/images/image-1/alt",
        {
          method: "PATCH",
          body: JSON.stringify({
            alt: "AI generated alt",
            source: "ai",
            model: "deepseek-chat",
          }),
        },
      ) as never,
      params(),
    );

    expect(imageAltUpdater.updateShoplineImageAlt).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "product-1",
      "image-1",
      "AI generated alt",
      {
        store: { store: true },
        auditOptions: {
          supabase: authState.supabase,
          userId: "user-1",
          source: "ai",
          model: "deepseek-chat",
        },
      },
    );
  });
});
