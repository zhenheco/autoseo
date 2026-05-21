import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildAuthorizeUrlMock, invitationQuery, supabaseMock, websiteQuery } =
  vi.hoisted(() => {
    const buildAuthorizeUrlMock = vi.fn();

    const invitationQuery = {
      select: vi.fn(() => invitationQuery),
      eq: vi.fn(() => invitationQuery),
      maybeSingle: vi.fn(
        async (): Promise<{ data: unknown | null; error: null }> => ({
          data: null,
          error: null,
        }),
      ),
    };

    const websiteQuery = {
      select: vi.fn(() => websiteQuery),
      eq: vi.fn(() => websiteQuery),
      insert: vi.fn(() => websiteQuery),
      maybeSingle: vi.fn(
        async (): Promise<{ data: { id: string } | null; error: null }> => ({
          data: null,
          error: null,
        }),
      ),
      single: vi.fn(
        async (): Promise<{ data: { id: string } | null; error: null }> => ({
          data: { id: "website-created" },
          error: null,
        }),
      ),
    };

    const supabaseMock = {
      from: vi.fn((table: string) => {
        if (table === "shopline_install_invitations") return invitationQuery;
        if (table === "website_configs") return websiteQuery;
        throw new Error(`unexpected table: ${table}`);
      }),
    };

    return {
      buildAuthorizeUrlMock,
      invitationQuery,
      supabaseMock,
      websiteQuery,
    };
  });

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(() => supabaseMock),
}));

vi.mock("@/lib/shopline/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopline/oauth")>();
  return {
    ...actual,
    buildAuthorizeUrl: buildAuthorizeUrlMock,
  };
});

import { GET } from "../route";

function request(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

function context(token = "invite-token") {
  return { params: Promise.resolve({ token }) };
}

function invitationRow(overrides: Record<string, unknown> = {}) {
  return {
    token: "invite-token",
    company_id: "company-1",
    expected_shop_handle: null,
    note: null,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    last_redeemed_at: null,
    redeem_count: 0,
    revoked_at: null,
    created_at: "2026-05-20T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  invitationQuery.select.mockClear();
  invitationQuery.eq.mockClear();
  invitationQuery.maybeSingle.mockReset();
  invitationQuery.maybeSingle.mockResolvedValue({
    data: null,
    error: null,
  });
  websiteQuery.select.mockClear();
  websiteQuery.eq.mockClear();
  websiteQuery.insert.mockClear();
  websiteQuery.maybeSingle.mockReset();
  websiteQuery.maybeSingle.mockResolvedValue({
    data: null,
    error: null,
  });
  websiteQuery.single.mockReset();
  websiteQuery.single.mockResolvedValue({
    data: { id: "website-created" },
    error: null,
  });
  supabaseMock.from.mockClear();
  buildAuthorizeUrlMock.mockReset();
  buildAuthorizeUrlMock.mockResolvedValue({
    url: "https://demo-shop.myshopline.com/admin/oauth-web/#/oauth/authorize?appKey=test",
    cookieNonce: "nonce-1",
  });
});

describe("public SHOPLINE invitation install route", () => {
  it("returns missing_shop_handle when shopHandle is absent", async () => {
    const resp = await GET(
      request("https://1wayseo.com/api/connect/shopline/invite-token/install"),
      context(),
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "missing_shop_handle",
    });
  });

  it("returns invalid_shop_handle when shopHandle cannot be normalized", async () => {
    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/invite-token/install?shopHandle=bad%20shop",
      ),
      context(),
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "invalid_shop_handle",
    });
  });

  it("redirects to the public page with invalid when the token does not exist", async () => {
    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/missing-token/install?shopHandle=demo-shop",
      ),
      context("missing-token"),
    );

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/connect/shopline/missing-token?error=invalid",
    );
    expect(supabaseMock.from).toHaveBeenCalledWith(
      "shopline_install_invitations",
    );
    expect(invitationQuery.eq).toHaveBeenCalledWith("token", "missing-token");
  });

  it("redirects to the public page with expired when the token is expired", async () => {
    invitationQuery.maybeSingle.mockResolvedValueOnce({
      data: invitationRow({
        token: "expired-token",
        expires_at: new Date(Date.now() - 1_000).toISOString(),
      }),
      error: null,
    });

    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/expired-token/install?shopHandle=demo-shop",
      ),
      context("expired-token"),
    );

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/connect/shopline/expired-token?error=expired",
    );
  });

  it("redirects to the public page with revoked when the token is revoked", async () => {
    invitationQuery.maybeSingle.mockResolvedValueOnce({
      data: invitationRow({
        token: "revoked-token",
        revoked_at: "2026-05-20T01:00:00.000Z",
      }),
      error: null,
    });

    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/revoked-token/install?shopHandle=demo-shop",
      ),
      context("revoked-token"),
    );

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/connect/shopline/revoked-token?error=revoked",
    );
  });

  it("redirects active invitations to SHOPLINE authorize URL and sets the nonce cookie", async () => {
    invitationQuery.maybeSingle.mockResolvedValueOnce({
      data: invitationRow({
        token: "active-token",
        company_id: "company-1",
        expected_shop_handle: "demo-shop",
      }),
      error: null,
    });

    const resp = await GET(
      request(
        "https://1wayseo.com/api/connect/shopline/active-token/install?shopHandle=demo-shop.myshopline.com",
      ),
      context("active-token"),
    );

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://demo-shop.myshopline.com/admin/oauth-web/#/oauth/authorize?appKey=test",
    );
    expect(resp.headers.get("set-cookie")).toMatch(
      /shopline_oauth_nonce=nonce-1; HttpOnly; Secure; SameSite=Lax; Path=\/api\/oauth\/shopline\/callback; Max-Age=600/,
    );
    expect(websiteQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
    expect(websiteQuery.eq).toHaveBeenCalledWith(
      "wordpress_url",
      "https://demo-shop.myshopline.com",
    );
    expect(websiteQuery.insert).toHaveBeenCalledWith({
      company_id: "company-1",
      website_name: "demo-shop",
      wordpress_url: "https://demo-shop.myshopline.com",
      website_type: "shopline",
      wp_enabled: false,
      is_active: true,
      language: "zh-TW",
      created_by: null,
    });
    expect(buildAuthorizeUrlMock).toHaveBeenCalledWith({
      workspaceId: "company-1",
      siteId: "website-created",
      shopHandle: "demo-shop",
      returnTo: "/connect/shopline/active-token/done?shop=demo-shop",
      invitationToken: "active-token",
    });
  });
});
