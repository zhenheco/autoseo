import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoplineAuthError } from "@/lib/shopline/types";

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
            supabase: {},
          },
          ...args,
        );
      },
  ),
}));

const adminState = vi.hoisted(() => ({
  website: { id: "website-1" } as { id: string } | null,
  calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

const supabaseAdmin = vi.hoisted(() => ({
  createAdminClient: vi.fn(() => ({
    from(table: string) {
      const builder = {
        select(...args: unknown[]) {
          adminState.calls.push({ table, method: "select", args });
          return builder;
        },
        eq(...args: unknown[]) {
          adminState.calls.push({ table, method: "eq", args });
          return builder;
        },
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

const collectionFetcher = vi.hoisted(() => ({
  fetchShoplineCollections: vi.fn(),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);
vi.mock("@shared/supabase", () => supabaseAdmin);
vi.mock("@/lib/shopline/connections", () => connections);
vi.mock("@/lib/shopline/collection-fetcher", () => collectionFetcher);

function params(websiteId = "website-1") {
  return {
    params: Promise.resolve({ websiteId }),
  };
}

const filterCollections = [
  {
    id: "collection-missing-title",
    title: "Missing SEO title",
    handle: "missing-seo-title",
    seo: { title: "", description: "SEO description" },
  },
  {
    id: "collection-missing-description",
    title: "Missing SEO description",
    handle: "missing-seo-description",
    seo: { title: "SEO title", description: "" },
  },
  {
    id: "collection-title-too-long",
    title: "Title too long",
    handle: "title-too-long",
    seo: { title: "t".repeat(71), description: "SEO description" },
  },
  {
    id: "collection-description-too-long",
    title: "Description too long",
    handle: "description-too-long",
    seo: { title: "SEO title", description: "d".repeat(161) },
  },
  {
    id: "collection-duplicate-a",
    title: "Duplicate title",
    handle: "duplicate-a",
    seo: { title: "SEO title", description: "SEO description" },
  },
  {
    id: "collection-duplicate-b",
    title: "Duplicate title",
    handle: "duplicate-b",
    seo: { title: "SEO title", description: "SEO description" },
  },
  {
    id: "collection-healthy",
    title: "Healthy collection",
    handle: "healthy",
    seo: { title: "SEO title", description: "SEO description" },
  },
];

describe("GET /api/shopline/[websiteId]/collections", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authState.authenticated = true;
    adminState.website = { id: "website-1" };
    adminState.calls = [];
    collectionFetcher.fetchShoplineCollections.mockResolvedValue({
      collections: [],
      nextCursor: null,
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authState.authenticated = false;
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections",
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
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections",
      ) as never,
      params(),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Website not found",
    });
    expect(collectionFetcher.fetchShoplineCollections).not.toHaveBeenCalled();
  });

  it("returns shopline_no_connection when no SHOPLINE connection exists", async () => {
    collectionFetcher.fetchShoplineCollections.mockRejectedValueOnce(
      new Error("shopline_no_connection"),
    );
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections",
      ) as never,
      params(),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_no_connection",
    });
  });

  it("maps SHOPLINE auth errors to shopline_auth_invalid with reauthorize_url", async () => {
    collectionFetcher.fetchShoplineCollections.mockRejectedValueOnce(
      new ShoplineAuthError(),
    );
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections",
      ) as never,
      params(),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "shopline_auth_invalid",
      reauthorize_url: "/api/oauth/shopline/install?siteId=website-1",
    });
  });

  it("returns collections and nextCursor for a connected website", async () => {
    const collections = [
      {
        id: "collection-1",
        title: "Collection 1",
        handle: "collection-1",
        seo: { title: "SEO title" },
      },
    ];
    collectionFetcher.fetchShoplineCollections.mockResolvedValueOnce({
      collections,
      nextCursor: "cursor-next",
    });
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        "https://1wayseo.com/api/shopline/website-1/collections?cursor=cursor-1",
      ) as never,
      params(),
    );

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
    expect(adminState.calls).toContainEqual({
      table: "website_configs",
      method: "eq",
      args: ["company_id", "company-1"],
    });
    expect(collectionFetcher.fetchShoplineCollections).toHaveBeenCalledWith(
      "company-1",
      "website-1",
      "cursor-1",
      { store: { store: true } },
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collections,
      nextCursor: "cursor-next",
    });
  });

  it.each([
    [
      "missing-seo",
      ["collection-missing-title", "collection-missing-description"],
    ],
    ["title-too-long", ["collection-title-too-long"]],
    ["description-too-long", ["collection-description-too-long"]],
    ["duplicate-title", ["collection-duplicate-a", "collection-duplicate-b"]],
    ["missing-alt", filterCollections.map((collection) => collection.id)],
    ["unknown-filter", filterCollections.map((collection) => collection.id)],
  ])("filters collections by %s", async (filter, expectedIds) => {
    collectionFetcher.fetchShoplineCollections.mockResolvedValueOnce({
      collections: filterCollections,
      nextCursor: "cursor-next",
    });
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        `https://1wayseo.com/api/shopline/website-1/collections?filter=${filter}`,
      ) as never,
      params(),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      collections: expectedIds.map((id) =>
        expect.objectContaining({
          id,
        }),
      ),
      nextCursor: "cursor-next",
    });
  });
});
