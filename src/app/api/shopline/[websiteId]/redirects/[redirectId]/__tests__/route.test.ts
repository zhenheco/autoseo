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
  deleteShoplineRedirect: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/rate-limiter", () => rateLimiter);
vi.mock("@/lib/shopline/redirect-store", () => redirectStore);

function params(websiteId = "website-1", redirectId = "redirect-1") {
  return {
    params: Promise.resolve({ websiteId, redirectId }),
  };
}

describe("DELETE /api/shopline/[websiteId]/redirects/[redirectId]", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValue({
      allowed: true,
    });
    redirectStore.deleteShoplineRedirect.mockResolvedValue(undefined);
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/redirects/redirect-1",
        { method: "DELETE" },
      ) as never,
      params(),
    );

    expect(response.status).toBe(401);
  });

  it("returns 429 when write rate limit is exceeded", async () => {
    rateLimiter.checkShoplineWriteRateLimit.mockResolvedValueOnce({
      allowed: false,
      retryAfter: 15,
    });
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/redirects/redirect-1",
        { method: "DELETE" },
      ) as never,
      params(),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("15");
    expect(redirectStore.deleteShoplineRedirect).not.toHaveBeenCalled();
  });

  it("returns 403 when the company does not own the website", async () => {
    adminState.website = null;
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/redirects/redirect-1",
        { method: "DELETE" },
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(redirectStore.deleteShoplineRedirect).not.toHaveBeenCalled();
  });

  it("deletes a redirect and returns 204", async () => {
    const { DELETE } = await import("../route");

    const response = await DELETE(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/redirects/redirect-1",
        { method: "DELETE" },
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
    expect(redirectStore.deleteShoplineRedirect).toHaveBeenCalledWith(
      authState.supabase,
      "redirect-1",
    );
    expect(response.status).toBe(204);
  });
});
