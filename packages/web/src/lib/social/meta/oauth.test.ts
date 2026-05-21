import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  META_OAUTH_SCOPE,
  buildMetaAuthorizeUrl,
  exchangeMetaCodeForShortLivedToken,
  exchangeMetaTokenForLongLivedToken,
  fetchMetaPageAccess,
} from "./oauth";

describe("Meta OAuth helpers", () => {
  beforeEach(() => {
    vi.stubEnv("META_APP_ID", "meta-app-id");
    vi.stubEnv("META_APP_SECRET", "meta-app-secret");
  });

  it("builds the Meta authorize URL with App Review scopes", () => {
    const url = new URL(
      buildMetaAuthorizeUrl({
        appId: "app-1",
        redirectUri: "https://1wayseo.com/api/social/meta/callback",
        state: "state-1",
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://www.facebook.com/v19.0/dialog/oauth",
    );
    expect(url.searchParams.get("client_id")).toBe("app-1");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://1wayseo.com/api/social/meta/callback",
    );
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(META_OAUTH_SCOPE);
  });

  it("exchanges an authorization code and then a long-lived token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "short-token",
          token_type: "bearer",
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "long-token",
          token_type: "bearer",
          expires_in: 60 * 24 * 60 * 60,
        }),
      });

    const short = await exchangeMetaCodeForShortLivedToken({
      code: "code-1",
      redirectUri: "https://1wayseo.com/api/social/meta/callback",
      fetchImpl: fetchImpl as never,
    });
    const long = await exchangeMetaTokenForLongLivedToken({
      accessToken: short.access_token,
      fetchImpl: fetchImpl as never,
    });

    expect(short.access_token).toBe("short-token");
    expect(long.access_token).toBe("long-token");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("oauth/access_token");
    expect(String(fetchImpl.mock.calls[1][0])).toContain(
      "grant_type=fb_exchange_token",
    );
  });

  it("fetches a page-scoped access token for a Facebook Page", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "page-1",
        name: "Page One",
        access_token: "page-token",
        instagram_business_account: {
          id: "ig-1",
          username: "ig_one",
        },
      }),
    }));

    const page = await fetchMetaPageAccess({
      pageId: "page-1",
      userAccessToken: "long-token",
      fetchImpl: fetchImpl as never,
    });

    expect(page.access_token).toBe("page-token");
    expect(page.instagram_business_account?.id).toBe("ig-1");
    const calls = fetchImpl.mock.calls as unknown as Array<[string]>;
    expect(String(calls[0][0])).toContain("page-1");
    expect(String(calls[0][0])).toContain("instagram_business_account");
  });
});
