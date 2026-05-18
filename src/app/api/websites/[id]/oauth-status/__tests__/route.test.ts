import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getShoplineConnectionStatusMock } = vi.hoisted(() => ({
  getShoplineConnectionStatusMock: vi.fn(),
}));

function queryResult(data: unknown) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => ({ data, error: null })),
  };
  return query;
}

const websiteQuery = queryResult({ id: "website-1" });
const gscQuery = queryResult(null);
const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table === "website_configs") return websiteQuery;
    throw new Error(`unexpected table: ${table}`);
  }),
};
const adminClientMock = {
  from: vi.fn((table: string) => {
    if (table === "google_oauth_tokens") return gscQuery;
    throw new Error(`unexpected table: ${table}`);
  }),
};

vi.mock("@/lib/api/auth-middleware", () => ({
  extractPathParams: vi.fn(() => ({ id: "website-1" })),
  withFullAuth: (handler: unknown) => (request: Request) =>
    (handler as CallableFunction)(request, {
      supabase: supabaseMock,
      adminClient: adminClientMock,
      companyId: "company-1",
      user: { id: "user-1" },
    }),
}));

vi.mock("@/lib/shopline/connections", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/shopline/connections")>();
  return {
    ...actual,
    createSupabaseShoplineConnectionStore: vi.fn(() => ({ store: true })),
    getShoplineConnectionStatus: getShoplineConnectionStatusMock,
  };
});

import { GET } from "../route";

beforeEach(() => {
  vi.clearAllMocks();
  getShoplineConnectionStatusMock.mockResolvedValue({
    connected: true,
    shopHandle: "demo-shop",
    shopDomain: "demo-shop.myshopline.com",
    grantedScopes: ["read_products"],
    status: "active",
    lastVerifiedAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  });
});

describe("website oauth status route", () => {
  it("includes SHOPLINE connection status without token material", async () => {
    const resp = await GET(
      new Request(
        "https://1wayseo.com/api/websites/website-1/oauth-status",
      ) as unknown as NextRequest,
    );
    const body = await resp.json();

    expect(resp.status, JSON.stringify(body)).toBe(200);
    expect(getShoplineConnectionStatusMock).toHaveBeenCalledWith(
      { store: true },
      {
        companyId: "company-1",
        websiteId: "website-1",
      },
    );
    expect(body.data.shopline).toEqual({
      connected: true,
      shopHandle: "demo-shop",
      shopDomain: "demo-shop.myshopline.com",
      grantedScopes: ["read_products"],
      status: "active",
      lastVerifiedAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z",
    });
    expect(JSON.stringify(body)).not.toMatch(/token|encrypted/i);
  });
});
