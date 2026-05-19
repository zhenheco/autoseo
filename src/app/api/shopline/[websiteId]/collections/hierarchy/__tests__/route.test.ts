import { beforeEach, describe, expect, it, vi } from "vitest";

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

const hierarchyService = vi.hoisted(() => ({
  getCollectionHierarchy: vi.fn(async () => [
    {
      collection_id: "child",
      parent_collection_id: "parent",
      display_order: 2,
    },
  ]),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@/lib/supabase/admin", () => supabaseAdmin);
vi.mock("@/lib/shopline/collection-hierarchy-service", () => hierarchyService);

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

describe("GET /api/shopline/[websiteId]/collections/hierarchy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    authState.supabase = { from: vi.fn() };
    adminState.website = { id: "website-1" };
    hierarchyService.getCollectionHierarchy.mockResolvedValue([
      {
        collection_id: "child",
        parent_collection_id: "parent",
        display_order: 2,
      },
    ]);
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/hierarchy",
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
        "https://1wayseo.com/api/shopline/website-1/collections/hierarchy",
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
  });

  it("returns hierarchy rows for an owned website", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections/hierarchy",
      ) as never,
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(hierarchyService.getCollectionHierarchy).toHaveBeenCalledWith(
      authState.supabase,
      "website-1",
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hierarchy: [
        {
          collection_id: "child",
          parent_collection_id: "parent",
          display_order: 2,
        },
      ],
    });
  });
});
