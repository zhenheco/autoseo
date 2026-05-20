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
  getGrantedScopes: vi.fn(async () => [
    "read_products",
    "write_products",
    "write_content",
  ]),
}));

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const categorizer = vi.hoisted(() => ({
  updateShoplineProductCategories: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/product-categorizer", () => categorizer);

function params(websiteId = "website-1", productId = "product-1") {
  return {
    params: Promise.resolve({ websiteId, productId }),
  };
}

function patchRequest(body: unknown) {
  return new Request(
    "https://1wayseo.com/api/shopline/website-1/products/product-1/categories",
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  ) as never;
}

describe("PATCH /api/shopline/[websiteId]/products/[productId]/categories", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    scopeResolver.getGrantedScopes.mockResolvedValue([
      "read_products",
      "write_products",
      "write_content",
    ]);
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    categorizer.updateShoplineProductCategories.mockResolvedValue({
      added: [{ collection_id: "collection-add", success: true }],
      removed: [{ collection_id: "collection-remove", success: true }],
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: ["collection-add"], remove: [] }),
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
      patchRequest({ add: ["collection-add"], remove: [] }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(categorizer.updateShoplineProductCategories).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      {
        url: "https://1wayseo.com/api/shopline/website-1/products/product-1/categories",
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

  it("returns 400 when add or remove contains more than 50 ids", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: Array.from({ length: 51 }, (_, i) => `c-${i}`) }),
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body",
    });
    expect(categorizer.updateShoplineProductCategories).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 17,
    });
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: ["collection-add"], remove: [] }),
      params(),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(response.json()).resolves.toEqual({
      error: "shopline_rate_limited",
      retryAfter: 17,
    });
    expect(scopeResolver.getGrantedScopes).not.toHaveBeenCalled();
  });

  it("returns 403 with missing scopes when write_products or write_content is absent", async () => {
    scopeResolver.getGrantedScopes.mockResolvedValueOnce(["read_products"]);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: ["collection-add"], remove: [] }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_scope_missing",
      missing_scopes: ["write_products", "write_content"],
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
    expect(categorizer.updateShoplineProductCategories).not.toHaveBeenCalled();
  });

  it("returns 502 with reauthorize_url when SHOPLINE rejects auth", async () => {
    categorizer.updateShoplineProductCategories.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: ["collection-add"], remove: [] }),
      params(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_auth_invalid",
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });

  it("updates categories and returns added and removed details", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: ["collection-add"], remove: ["collection-remove"] }),
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
    expect(categorizer.updateShoplineProductCategories).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "product-1",
      { add: ["collection-add"], remove: ["collection-remove"] },
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
    await expect(response.json()).resolves.toEqual({
      added: [{ collection_id: "collection-add", success: true }],
      removed: [{ collection_id: "collection-remove", success: true }],
    });
  });

  it("returns 200 with failed details when all add operations fail", async () => {
    categorizer.updateShoplineProductCategories.mockResolvedValueOnce({
      added: [
        {
          collection_id: "collection-add",
          success: false,
          error: "assign failed",
        },
      ],
      removed: [],
    });
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ add: ["collection-add"], remove: [] }),
      params(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      added: [
        {
          collection_id: "collection-add",
          success: false,
          error: "assign failed",
        },
      ],
      removed: [],
    });
  });
});
