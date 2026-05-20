import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  SHOPLINE_OAUTH_SCOPES,
  verifyShoplineHmac,
  verifyState,
} from "../oauth";

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("OAUTH_STATE_SECRET", "test-secret-32-chars-long-padding-x");
  vi.stubEnv("SHOPLINE_CLIENT_ID", "test-client-id");
  vi.stubEnv("SHOPLINE_CLIENT_SECRET", "test-shopline-secret");
  vi.stubEnv(
    "SHOPLINE_REDIRECT_URI",
    "https://1wayseo.com/api/oauth/shopline/callback",
  );
  vi.stubEnv("SHOPLINE_APP_TYPE", "customized");
  vi.stubEnv(
    "SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE",
    "https://{shopHandle}.myshopline.com/admin/oauth-web/#/oauth/authorize?appKey={clientId}&responseType=code&scope={scope}&redirectUri={redirectUri}&customField={state}",
  );
});

function shoplineAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const hashQuery = parsed.hash.split("?")[1];
  return new URLSearchParams(hashQuery ?? parsed.search);
}

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

describe("buildAuthorizeUrl", () => {
  it("builds a customized app OAuth authorization URL with callback parameters", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe("https://demo-shop.myshopline.com");
    expect(parsed.pathname).toBe("/admin/oauth-web/");
    expect(parsed.search).toBe("");
    expect(parsed.hash).toMatch(/^#\/oauth\/authorize\?/);

    const params = shoplineAuthParams(url);
    expect(params.get("appKey")).toBe("test-client-id");
    expect(params.get("responseType")).toBe("code");
    expect(params.get("scope")).toBe(SHOPLINE_OAUTH_SCOPES.join(","));
    expect(params.get("redirectUri")).toBe(
      "https://1wayseo.com/api/oauth/shopline/callback",
    );
    expect(params.get("customField")).toBeTruthy();
    expect(cookieNonce).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("requests the SEO write scopes needed for assisted SHOPLINE operations", () => {
    expect(SHOPLINE_OAUTH_SCOPES).toEqual([
      "read_products",
      "write_products",
      "read_product_listings",
      "read_content",
      "write_content",
      "write_page",
    ]);
  });

  it("falls back to oauth-web URL when the customized template is not configured", async () => {
    vi.stubEnv("SHOPLINE_CUSTOMIZED_INSTALL_URL_TEMPLATE", "");

    const { url } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });

    expect(url).toMatch(
      /^https:\/\/demo-shop\.myshopline\.com\/admin\/oauth-web\/#\/oauth\/authorize\?/,
    );
    expect(shoplineAuthParams(url).get("customField")).toBeTruthy();
  });

  it("rejects invalid shop handles before building an external URL", async () => {
    await expect(
      buildAuthorizeUrl({
        workspaceId: "w1",
        siteId: "s1",
        shopHandle: "evil.com/path",
      }),
    ).rejects.toThrow(/invalid_shopline_shop_handle/);
  });
});

describe("verifyState", () => {
  it("round-trips signed state and keeps only safe relative returnTo", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
      returnTo: "/dashboard/websites",
    });
    const state = shoplineAuthParams(url).get("customField")!;

    await expect(verifyState(state, cookieNonce)).resolves.toMatchObject({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
      returnTo: "/dashboard/websites",
    });
  });

  it("round-trips invitationToken through signed state", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
      invitationToken: "tok-123",
    });
    const state = shoplineAuthParams(url).get("customField")!;

    const verified = await verifyState(state, cookieNonce);
    expect(verified.invitationToken).toBe("tok-123");
  });

  it("drops absolute returnTo values", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
      returnTo: "https://evil.example/path",
    });
    const state = shoplineAuthParams(url).get("customField")!;

    const verified = await verifyState(state, cookieNonce);
    expect(verified.returnTo).toBeUndefined();
  });

  it("leaves invitationToken undefined when it is not provided", async () => {
    const { url, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });
    const state = shoplineAuthParams(url).get("customField")!;

    const verified = await verifyState(state, cookieNonce);
    expect(Reflect.get(verified, "invitationToken")).toBeUndefined();
  });

  it("rejects tampered state and cookie nonce mismatch", async () => {
    const { url } = await buildAuthorizeUrl({
      workspaceId: "w1",
      siteId: "s1",
      shopHandle: "demo-shop",
    });
    const state = shoplineAuthParams(url).get("customField")!;

    await expect(
      verifyState(`${state}tampered`, "bad-cookie"),
    ).rejects.toThrow();
    await expect(verifyState(state, "bad-cookie")).rejects.toThrow(
      /cookie nonce/i,
    );
  });
});

describe("verifyShoplineHmac", () => {
  it("accepts custom app sign parameter", async () => {
    const params = new URLSearchParams({
      appkey: "app-key",
      code: "auth-code",
      customField: "signed.state",
      handle: "demo-shop",
      timestamp: "1778379980000",
    });
    params.set("sign", await signShoplineParams(params));

    await expect(verifyShoplineHmac(params)).resolves.toBe(true);
  });

  it("rejects invalid hmac", async () => {
    const params = new URLSearchParams({
      code: "auth-code",
      shop: "demo-shop.myshopline.com",
      state: "signed-state",
      hmac: "bad",
    });

    await expect(verifyShoplineHmac(params)).resolves.toBe(false);
  });
});

describe("exchangeCodeForToken", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("POSTs signed JSON body to the Shopline token endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        code: 200,
        data: { accessToken: "tok123", scope: "read_products" },
      }),
    });

    const result = await exchangeCodeForToken("demo-shop", "auth-code");
    expect(result).toEqual({ access_token: "tok123", scope: "read_products" });

    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(
      "https://demo-shop.myshopline.com/admin/oauth/token/create",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.appkey).toBe("test-client-id");
    expect(init.headers.timestamp).toMatch(/^\d+$/);
    expect(init.headers.sign).toMatch(/^[0-9a-f]{64}$/);
    expect(init.body).toBe(JSON.stringify({ code: "auth-code" }));
  });

  it("throws without printing token data when token exchange fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => "invalid client",
    });

    await expect(exchangeCodeForToken("demo-shop", "bad-code")).rejects.toThrow(
      /shopline_token_exchange_failed.*401.*invalid client/i,
    );
  });
});
