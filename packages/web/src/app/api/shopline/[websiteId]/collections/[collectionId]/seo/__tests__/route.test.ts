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
  getGrantedScopes: vi.fn(async () => ["read_products", "write_content"]),
}));

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const collectionSeoUpdater = vi.hoisted(() => ({
  updateShoplineCollectionSeo: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/collection-seo-updater", () => collectionSeoUpdater);

function params(websiteId = "website-1", collectionId = "collection-1") {
  return {
    params: Promise.resolve({ websiteId, collectionId }),
  };
}

describe("PATCH /api/shopline/[websiteId]/collections/[collectionId]/seo", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    scopeResolver.getGrantedScopes.mockResolvedValue([
      "read_products",
      "write_content",
    ]);
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    collectionSeoUpdater.updateShoplineCollectionSeo.mockResolvedValue({
      id: "collection-1",
      title: "Collection 1",
      handle: "collection-1",
      seo: { title: "Updated SEO title" },
    });
  });

  it("returns 400 for malformed JSON using the standard shape", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      {
        url: "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
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
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
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
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
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
    expect(
      collectionSeoUpdater.updateShoplineCollectionSeo,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 when the body shape is invalid", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({ handle: "Invalid Handle" }),
        },
      ) as never,
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body",
    });
  });

  it("returns 429 with Retry-After when the company write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
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
    expect(
      collectionSeoUpdater.updateShoplineCollectionSeo,
    ).not.toHaveBeenCalled();
  });

  it("returns 403 with missing_scopes when the connection lacks write_content", async () => {
    scopeResolver.getGrantedScopes.mockResolvedValueOnce(["read_products"]);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
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
      missing_scopes: ["write_content"],
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
    expect(
      collectionSeoUpdater.updateShoplineCollectionSeo,
    ).not.toHaveBeenCalled();
  });

  it("updates collection SEO and returns the updated collection", async () => {
    const updatedCollection = {
      id: "collection-1",
      title: "Collection 1",
      handle: "collection-1",
      seo: { title: "Updated SEO title" },
    };
    collectionSeoUpdater.updateShoplineCollectionSeo.mockResolvedValueOnce(
      updatedCollection,
    );
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({
            seo: { title: "Updated SEO title" },
            handle: "collection-1",
            title: "Collection 1",
          }),
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
    expect(
      collectionSeoUpdater.updateShoplineCollectionSeo,
    ).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "collection-1",
      {
        seo: { title: "Updated SEO title" },
        handle: "collection-1",
        title: "Collection 1",
      },
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
    await expect(response.json()).resolves.toEqual(updatedCollection);
  });

  it("passes AI source and model to collection SEO audit options", async () => {
    const { PATCH } = await import("../route");

    await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
        {
          method: "PATCH",
          body: JSON.stringify({
            seo: { title: "AI SEO title" },
            source: "ai",
            model: "openai/gpt-5-mini",
          }),
        },
      ) as never,
      params(),
    );

    expect(
      collectionSeoUpdater.updateShoplineCollectionSeo,
    ).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "collection-1",
      { seo: { title: "AI SEO title" } },
      {
        store: { store: true },
        auditOptions: {
          supabase: authState.supabase,
          userId: "user-1",
          source: "ai",
          model: "openai/gpt-5-mini",
        },
      },
    );
  });

  it("maps SHOPLINE auth errors to shopline_auth_invalid with reauthorize_url", async () => {
    collectionSeoUpdater.updateShoplineCollectionSeo.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { PATCH } = await import("../route");

    const response = await PATCH(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/collection-1/seo",
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
