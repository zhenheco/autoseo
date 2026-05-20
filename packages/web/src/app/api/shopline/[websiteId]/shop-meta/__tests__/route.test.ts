import { beforeEach, describe, expect, it, vi } from "vitest";

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

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const service = vi.hoisted(() => ({
  getShoplineShopMeta: vi.fn(),
  upsertShoplineShopMeta: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@shared/supabase", () => supabaseAdmin);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/shop-meta-service", () => service);

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

describe("/api/shopline/[websiteId]/shop-meta", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    service.getShoplineShopMeta.mockResolvedValue(null);
    service.upsertShoplineShopMeta.mockResolvedValue({
      website_id: "website-1",
      seo_title_template: "{{product.title}} | Demo",
      default_description: "Default",
      robots_index_products: false,
      robots_index_collections: true,
      sitemap_enabled: true,
      default_og_image: null,
      hreflang_map: null,
      updated_at: "2026-05-20T00:00:00.000Z",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/shop-meta",
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
        "https://1wayseo.com/api/shopline/website-1/shop-meta",
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(service.getShoplineShopMeta).not.toHaveBeenCalled();
  });

  it("returns default shop meta when no row exists", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/shop-meta",
      ) as never,
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      website_id: "website-1",
      seo_title_template: null,
      default_description: null,
      robots_index_products: true,
      robots_index_collections: true,
      sitemap_enabled: true,
      default_og_image: null,
      hreflang_map: null,
    });
  });

  it("returns 400 for malformed JSON using the standard shape", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(
      {
        url: "https://1wayseo.com/api/shopline/website-1/shop-meta",
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

  it("returns 400 for invalid hreflang_map values", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(
      new Request("https://1wayseo.com/api/shopline/website-1/shop-meta", {
        method: "PUT",
        body: JSON.stringify({ hreflang_map: { en: 123 } }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
    });
    expect(service.upsertShoplineShopMeta).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
    const { PUT } = await import("../route");

    const response = await PUT(
      new Request("https://1wayseo.com/api/shopline/website-1/shop-meta", {
        method: "PUT",
        body: JSON.stringify({ sitemap_enabled: false }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: "shopline_rate_limited",
      retryAfter: 17,
    });
    expect(service.upsertShoplineShopMeta).not.toHaveBeenCalled();
  });

  it("upserts shop meta and returns the updated row", async () => {
    const { PUT } = await import("../route");

    const response = await PUT(
      new Request("https://1wayseo.com/api/shopline/website-1/shop-meta", {
        method: "PUT",
        body: JSON.stringify({
          seo_title_template: "{{product.title}} | Demo",
          robots_index_products: false,
        }),
      }) as never,
      params(),
    );

    expect(rateLimiter.checkShoplineWriteRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      "company-1",
    );
    expect(service.upsertShoplineShopMeta).toHaveBeenCalledWith(
      authState.supabase,
      "website-1",
      {
        seo_title_template: "{{product.title}} | Demo",
        robots_index_products: false,
      },
      { userId: "user-1", source: "ui" },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      website_id: "website-1",
      seo_title_template: "{{product.title}} | Demo",
      robots_index_products: false,
    });
  });
});
