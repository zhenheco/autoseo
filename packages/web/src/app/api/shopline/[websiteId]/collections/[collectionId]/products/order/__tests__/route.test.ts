import { beforeEach, describe, expect, it, vi } from "vitest";

type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfter: number };

const auditInsert = vi.hoisted(() => vi.fn(async () => ({ error: null })));

const authState = vi.hoisted(() => ({
  authenticated: true,
  supabase: {
    from: vi.fn((table: string) => {
      if (table === "shopline_seo_audit_log") {
        return { insert: auditInsert };
      }
      throw new Error(`unexpected table ${table}`);
    }),
  },
}));

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (_mode, handler) =>
      async (request: Request, ...args: unknown[]) => {
        if (!authState.authenticated) {
          const { NextResponse } = await import("next/server");
          return NextResponse.json(
            { error: "Unauthorized", code: "UNAUTHORIZED" },
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
  resolveShoplineAccessToken: vi.fn(async () => ({
    shopHandle: "demo-shop",
    accessToken: "tok",
    grantedScopes: ["read_products", "write_content"],
  })),
}));

const scopeResolver = vi.hoisted(() => ({
  getGrantedScopes: vi.fn(async () => ["read_products", "write_content"]),
}));

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const reorderCollectionProducts = vi.hoisted(() => vi.fn());
const clientModule = vi.hoisted(() => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return { reorderCollectionProducts };
  }),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/client", () => clientModule);

function params(websiteId = "website-1", collectionId = "collection-1") {
  return {
    params: Promise.resolve({ websiteId, collectionId }),
  };
}

function patchRequest(body: unknown) {
  return new Request(
    "https://1wayseo.com/api/shopline/website-1/collections/collection-1/products/order",
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  ) as never;
}

describe("PATCH /api/shopline/[websiteId]/collections/[collectionId]/products/order", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = {
      from: vi.fn((table: string) => {
        if (table === "shopline_seo_audit_log") {
          return { insert: auditInsert };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };
    adminState.website = { id: "website-1" };
    scopeResolver.getGrantedScopes.mockResolvedValue([
      "read_products",
      "write_content",
    ]);
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    connections.resolveShoplineAccessToken.mockResolvedValue({
      shopHandle: "demo-shop",
      accessToken: "tok",
      grantedScopes: ["read_products", "write_content"],
    });
    reorderCollectionProducts.mockResolvedValue(undefined);
    auditInsert.mockResolvedValue({ error: null });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ order: [{ productId: "product-1", position: 1 }] }),
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
      patchRequest({ order: [{ productId: "product-1", position: 1 }] }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(reorderCollectionProducts).not.toHaveBeenCalled();
  });

  it("returns 400 when order contains more than 200 products", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({
        order: Array.from({ length: 201 }, (_, index) => ({
          productId: `product-${index}`,
          position: index,
        })),
      }),
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body",
    });
  });

  it("returns 403 when write_content scope is missing", async () => {
    scopeResolver.getGrantedScopes.mockResolvedValueOnce(["read_products"]);
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ order: [{ productId: "product-1", position: 1 }] }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_scope_missing",
      missing_scopes: ["write_content"],
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });

  it("reorders collection products, audits the order, and returns ok", async () => {
    const { PATCH } = await import("../route");
    const order = [
      { productId: "product-1", position: 1 },
      { productId: "product-2", position: 2 },
    ];

    const response = await PATCH(patchRequest({ order }), params());

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(clientModule.ShoplineClient).toHaveBeenCalledWith({
      shopHandle: "demo-shop",
      accessToken: "tok",
    });
    expect(reorderCollectionProducts).toHaveBeenCalledWith(
      "collection-1",
      order,
    );
    expect(auditInsert).toHaveBeenCalledWith([
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "collection",
        entity_id: "collection-1",
        field: "products.position",
        before_value: null,
        after_value: JSON.stringify(order),
        source: "ui",
        model: null,
        user_id: "user-1",
      },
    ]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
