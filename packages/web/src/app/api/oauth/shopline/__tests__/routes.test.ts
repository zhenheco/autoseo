import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { persistShoplineConnectionMock } = vi.hoisted(() => ({
  persistShoplineConnectionMock: vi.fn(),
}));

const { websiteQuery, supabaseMock } = vi.hoisted(() => {
  const websiteQuery = {
    select: vi.fn(() => websiteQuery),
    eq: vi.fn(() => websiteQuery),
    maybeSingle: vi.fn(
      async (): Promise<{ data: { id: string } | null; error: null }> => ({
        data: { id: "website-1" },
        error: null,
      }),
    ),
  };

  const supabaseMock = {
    from: vi.fn((table: string) => {
      if (table === "website_configs") return websiteQuery;
      throw new Error(`unexpected table: ${table}`);
    }),
  };

  return { websiteQuery, supabaseMock };
});

vi.mock("@/lib/api/auth-middleware", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/auth-middleware")>();

  return {
    ...actual,
    withCompany: (handler: unknown) => (request: Request) =>
      (handler as CallableFunction)(request, {
        authMode: "company",
        companyId: "company-1",
        supabase: supabaseMock,
        user: { id: "user-1" },
      }),
  };
});

vi.mock("@/lib/shopline/connections", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/shopline/connections")>();
  return {
    ...actual,
    createSupabaseShoplineConnectionStore: vi.fn(() => ({ store: true })),
    persistShoplineConnection: persistShoplineConnectionMock,
  };
});

vi.mock("@shared/supabase", () => ({
  createAdminClient: vi.fn(() => ({ admin: true })),
}));

import { GET as callbackGet } from "../callback/route";
import { GET as installGet } from "../install/route";
import { buildAuthorizeUrl } from "@/lib/shopline/oauth";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("OAUTH_STATE_SECRET", "test-secret-32-chars-long-padding-x");
  vi.stubEnv("SHOPLINE_APP_TYPE", "customized");
  vi.stubEnv("SHOPLINE_CLIENT_ID", "test-client-id");
  vi.stubEnv("SHOPLINE_CLIENT_SECRET", "test-shopline-secret");
  vi.stubEnv(
    "SHOPLINE_REDIRECT_URI",
    "https://1wayseo.com/api/oauth/shopline/callback",
  );
  vi.stubEnv(
    "SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE",
    "https://{shopHandle}.myshopline.com/admin/oauth-web/#/oauth/authorize?appKey={clientId}&responseType=code&scope={scope}&redirectUri={redirectUri}&customField={state}",
  );
  vi.restoreAllMocks();
  websiteQuery.select.mockClear();
  websiteQuery.eq.mockClear();
  websiteQuery.maybeSingle.mockClear();
  websiteQuery.maybeSingle.mockResolvedValue({
    data: { id: "website-1" },
    error: null,
  });
  supabaseMock.from.mockClear();
  persistShoplineConnectionMock.mockReset();
  persistShoplineConnectionMock.mockResolvedValue({
    connected: true,
    shopHandle: "demo-shop",
    shopDomain: "demo-shop.myshopline.com",
    grantedScopes: ["read_products"],
    status: "active",
    lastVerifiedAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  });
});

async function signShoplineParams(params: URLSearchParams): Promise<string> {
  const canonical = [...params.keys()]
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params.get(key) ?? "")}`,
    )
    .join("&");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.SHOPLINE_CLIENT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonical),
  );
  return [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("SHOPLINE install route", () => {
  it("redirects owned customized app installs with signed state and a nonce cookie", async () => {
    const resp = await installGet(
      new Request(
        "https://1wayseo.com/api/oauth/shopline/install?shopHandle=demo-shop.myshopline.com&siteId=website-1",
      ) as unknown as NextRequest,
    );

    expect(resp.status).toBe(302);
    const location = resp.headers.get("location");
    expect(location).toBeTruthy();

    const parsed = new URL(location!);
    expect(parsed.origin).toBe("https://demo-shop.myshopline.com");
    expect(parsed.pathname).toBe("/admin/oauth-web/");
    expect(parsed.search).toBe("");
    const params = new URLSearchParams(parsed.hash.split("?")[1]);
    expect(params.get("customField")).toBeTruthy();
    expect(params.get("redirectUri")).toBe(
      "https://1wayseo.com/api/oauth/shopline/callback",
    );
    expect(resp.headers.get("set-cookie")).toMatch(
      /shopline_oauth_nonce=.*HttpOnly.*Path=\/api\/oauth\/shopline\/callback/,
    );
    expect(websiteQuery.eq).toHaveBeenCalledWith("id", "website-1");
    expect(websiteQuery.eq).toHaveBeenCalledWith("company_id", "company-1");
  });

  it("rejects missing shop handles before building an external URL", async () => {
    const resp = await installGet(
      new Request(
        "https://1wayseo.com/api/oauth/shopline/install",
      ) as unknown as NextRequest,
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "missing_shop_handle",
    });
  });

  it("rejects SaaS installs without a website identifier", async () => {
    const resp = await installGet(
      new Request(
        "https://1wayseo.com/api/oauth/shopline/install?shopHandle=demo-shop",
      ) as unknown as NextRequest,
    );

    expect(resp.status).toBe(400);
    await expect(resp.json()).resolves.toEqual({
      error: "missing_site_id",
    });
  });

  it("rejects installs for websites outside the signed-in company", async () => {
    websiteQuery.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const resp = await installGet(
      new Request(
        "https://1wayseo.com/api/oauth/shopline/install?shopHandle=demo-shop&siteId=website-2",
      ) as unknown as NextRequest,
    );

    expect(resp.status).toBe(404);
    await expect(resp.json()).resolves.toEqual({
      error: "website_not_found",
    });
  });
});

describe("SHOPLINE callback route", () => {
  it("returns a non-secret cancellation state without persisting tokens", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });
    const installUrl = new URL(url);
    const installParams = new URLSearchParams(installUrl.hash.split("?")[1]);
    const params = new URLSearchParams({
      customField: installParams.get("customField")!,
      handle: "demo-shop",
      error: "access_denied",
      error_description: "merchant rejected authorization",
    });

    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const resp = await callbackGet({
      url: `https://1wayseo.com/api/oauth/shopline/callback?${params.toString()}`,
      cookies: {
        get: (name: string) =>
          name === "shopline_oauth_nonce" ? { value: cookieNonce } : undefined,
      },
    } as unknown as NextRequest);

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/websites/s1/shopline?shopline=cancelled&reason=access_denied",
    );
    const body = await resp.text();
    expect(body).not.toContain("merchant rejected authorization");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(persistShoplineConnectionMock).not.toHaveBeenCalled();
    expect(resp.headers.get("set-cookie")).toContain("shopline_oauth_nonce=;");
  });

  it("exchanges a valid callback code without returning token contents", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });
    const installUrl = new URL(url);
    const installParams = new URLSearchParams(installUrl.hash.split("?")[1]);
    const params = new URLSearchParams({
      code: "auth-code",
      customField: installParams.get("customField")!,
      handle: "demo-shop",
      timestamp: "1778379980000",
    });
    params.set("sign", await signShoplineParams(params));

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        data: { accessToken: "token-never-returned", scope: "read_products" },
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const resp = await callbackGet({
      url: `https://1wayseo.com/api/oauth/shopline/callback?${params.toString()}`,
      cookies: {
        get: (name: string) =>
          name === "shopline_oauth_nonce" ? { value: cookieNonce } : undefined,
      },
    } as unknown as NextRequest);

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/websites/s1/shopline?shopline=connected&shopHandle=demo-shop",
    );
    const body = await resp.text();
    expect(JSON.stringify(body)).not.toContain("token-never-returned");
    expect(persistShoplineConnectionMock).toHaveBeenCalledWith(
      { store: true },
      expect.objectContaining({
        companyId: "w1",
        websiteId: "s1",
        shopHandle: "demo-shop",
        accessToken: "token-never-returned",
        scope: "read_products",
      }),
    );
    expect(resp.headers.get("set-cookie")).toContain("shopline_oauth_nonce=;");
  });

  it("falls back to the connection page when callback state has an unsafe returnTo", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
      returnTo: "https://evil.example/callback",
    });
    const installUrl = new URL(url);
    const installParams = new URLSearchParams(installUrl.hash.split("?")[1]);
    const params = new URLSearchParams({
      code: "auth-code",
      customField: installParams.get("customField")!,
      handle: "demo-shop",
      timestamp: "1778379980000",
    });
    params.set("sign", await signShoplineParams(params));

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        data: { accessToken: "token-never-returned", scope: "read_products" },
      }),
    }) as unknown as typeof fetch;

    const resp = await callbackGet({
      url: `https://1wayseo.com/api/oauth/shopline/callback?${params.toString()}`,
      cookies: {
        get: (name: string) =>
          name === "shopline_oauth_nonce" ? { value: cookieNonce } : undefined,
      },
    } as unknown as NextRequest);

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/websites/s1/shopline?shopline=connected&shopHandle=demo-shop",
    );
  });

  it("returns a non-secret error when SHOPLINE token exchange fails", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });
    const installUrl = new URL(url);
    const installParams = new URLSearchParams(installUrl.hash.split("?")[1]);
    const params = new URLSearchParams({
      code: "bad-code",
      customField: installParams.get("customField")!,
      handle: "demo-shop",
      timestamp: "1778379980000",
    });
    params.set("sign", await signShoplineParams(params));

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "invalid client secret should not leak",
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const resp = await callbackGet({
      url: `https://1wayseo.com/api/oauth/shopline/callback?${params.toString()}`,
      cookies: {
        get: (name: string) =>
          name === "shopline_oauth_nonce" ? { value: cookieNonce } : undefined,
      },
    } as unknown as NextRequest);

    expect(resp.status).toBe(302);
    expect(resp.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/websites/s1/shopline?shopline=error&error=shopline_token_exchange_failed",
    );
    const body = await resp.text();
    expect(body).not.toContain("invalid client secret");
    expect(persistShoplineConnectionMock).not.toHaveBeenCalled();
  });
});
