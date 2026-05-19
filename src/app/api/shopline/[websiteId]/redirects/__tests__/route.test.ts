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

const redirectStore = vi.hoisted(() => ({
  listShoplineRedirects: vi.fn(),
  createShoplineRedirect: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/redirect-store", () => redirectStore);

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

describe("GET /api/shopline/[websiteId]/redirects", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    redirectStore.listShoplineRedirects.mockResolvedValue([
      {
        id: "redirect-1",
        website_id: "website-1",
        entity_type: "product",
        entity_id: "product-1",
        handle_from: "old-product",
        handle_to: "new-product",
        created_at: "2026-05-20T00:00:00.000Z",
        last_hit_at: null,
        hit_count: 0,
      },
    ]);
    redirectStore.createShoplineRedirect.mockResolvedValue(undefined);
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://1wayseo.com/api/shopline/website-1/redirects"),
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
      new Request("https://1wayseo.com/api/shopline/website-1/redirects"),
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(redirectStore.listShoplineRedirects).not.toHaveBeenCalled();
  });

  it("returns redirects for an owned website", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new Request("https://1wayseo.com/api/shopline/website-1/redirects"),
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(redirectStore.listShoplineRedirects).toHaveBeenCalledWith(
      authState.supabase,
      "website-1",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      redirects: [
        {
          id: "redirect-1",
          website_id: "website-1",
          entity_type: "product",
          entity_id: "product-1",
          handle_from: "old-product",
          handle_to: "new-product",
          created_at: "2026-05-20T00:00:00.000Z",
          last_hit_at: null,
          hit_count: 0,
        },
      ],
    });
  });
});

describe("POST /api/shopline/[websiteId]/redirects", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    redirectStore.createShoplineRedirect.mockResolvedValue(undefined);
  });

  it("returns 400 for invalid request body", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/redirects", {
        method: "POST",
        body: JSON.stringify({ entityType: "product", handleFrom: "" }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid request body",
    });
  });

  it("returns 429 when write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 21,
    });
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/redirects", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          handleFrom: "old-product",
          handleTo: "new-product",
        }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("21");
    expect(redirectStore.createShoplineRedirect).not.toHaveBeenCalled();
  });

  it("returns 403 when the company does not own the website", async () => {
    adminState.website = null;
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/redirects", {
        method: "POST",
        body: JSON.stringify({
          entityType: "product",
          handleFrom: "old-product",
          handleTo: "new-product",
        }),
      }) as never,
      params(),
    );

    expect(response.status).toBe(403);
    expect(redirectStore.createShoplineRedirect).not.toHaveBeenCalled();
  });

  it("creates a redirect and returns 201", async () => {
    const { POST } = await import("../route");

    const response = await POST(
      new Request("https://1wayseo.com/api/shopline/website-1/redirects", {
        method: "POST",
        body: JSON.stringify({
          entityType: "collection",
          entityId: "collection-1",
          handleFrom: "old-collection",
          handleTo: "new-collection",
        }),
      }) as never,
      params(),
    );

    expect(rateLimiter.checkShoplineWriteRateLimit).toHaveBeenCalledWith(
      expect.anything(),
      "company-1",
    );
    expect(redirectStore.createShoplineRedirect).toHaveBeenCalledWith(
      authState.supabase,
      {
        websiteId: "website-1",
        entityType: "collection",
        entityId: "collection-1",
        handleFrom: "old-collection",
        handleTo: "new-collection",
      },
    );
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
