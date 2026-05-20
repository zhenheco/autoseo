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
}));

const scopeResolver = vi.hoisted(() => ({
  getGrantedScopes: vi.fn(async () => ["read_products", "write_content"]),
}));

const rateLimiter = vi.hoisted(() => ({
  checkShoplineWriteRateLimit: vi.fn<() => Promise<RateLimitResult>>(
    async () => ({ allowed: true }),
  ),
}));

const hierarchyService = vi.hoisted(() => ({
  reparentCollection: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/scope-resolver", () => scopeResolver);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/collection-hierarchy-service", () => hierarchyService);

function params(websiteId = "website-1", collectionId = "collection-1") {
  return {
    params: Promise.resolve({ websiteId, collectionId }),
  };
}

function patchRequest(body: unknown) {
  return new Request(
    "https://1wayseo.com/api/shopline/website-1/collections/collection-1/hierarchy",
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  ) as never;
}

describe("PATCH /api/shopline/[websiteId]/collections/[collectionId]/hierarchy", () => {
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
    hierarchyService.reparentCollection.mockResolvedValue(undefined);
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ parentCollectionId: null }),
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
      patchRequest({ parentCollectionId: null }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(hierarchyService.reparentCollection).not.toHaveBeenCalled();
  });

  it("returns 400 when the body shape is invalid", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ parentCollectionId: "parent-1", displayOrder: "first" }),
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
      patchRequest({ parentCollectionId: "parent-1" }),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_scope_missing",
      missing_scopes: ["write_content"],
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });

  it("reparents a collection and returns ok", async () => {
    const { PATCH } = await import("../route");

    const response = await PATCH(
      patchRequest({ parentCollectionId: "parent-1", displayOrder: 7 }),
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
    expect(hierarchyService.reparentCollection).toHaveBeenCalledWith(
      authState.supabase,
      {
        websiteId: "website-1",
        collectionId: "collection-1",
        parentCollectionId: "parent-1",
        displayOrder: 7,
      },
      { userId: "user-1", source: "ui" },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
