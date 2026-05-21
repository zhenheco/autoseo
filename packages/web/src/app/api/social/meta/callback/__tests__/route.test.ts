import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  createClientMock,
  exchangeCodeMock,
  exchangeLongMock,
  fetchMeMock,
  fetchPageAccessMock,
  fetchThreadsProfileMock,
  upsertMock,
  tokenCryptoMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  exchangeCodeMock: vi.fn(),
  exchangeLongMock: vi.fn(),
  fetchMeMock: vi.fn(),
  fetchPageAccessMock: vi.fn(),
  fetchThreadsProfileMock: vi.fn(),
  upsertMock: vi.fn(),
  tokenCryptoMock: {
    encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
    decrypt: vi.fn(),
  },
}));

vi.mock("@shared/supabase", () => ({
  createAdminClient: createAdminClientMock,
  createClient: createClientMock,
}));

vi.mock("@/lib/social/token-crypto", () => ({
  getSocialTokenCrypto: vi.fn(() => tokenCryptoMock),
}));

vi.mock("@/lib/social/meta/oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/social/meta/oauth")>();
  return {
    ...actual,
    exchangeMetaCodeForShortLivedToken: exchangeCodeMock,
    exchangeMetaTokenForLongLivedToken: exchangeLongMock,
    fetchMetaMeWithAccounts: fetchMeMock,
    fetchMetaPageAccess: fetchPageAccessMock,
    fetchThreadsProfile: fetchThreadsProfileMock,
  };
});

function createCookieRequest(url: string, cookies: Record<string, string>) {
  return {
    url,
    nextUrl: new URL(url),
    cookies: {
      get: (name: string) =>
        Object.prototype.hasOwnProperty.call(cookies, name)
          ? { value: cookies[name] }
          : undefined,
    },
  } as unknown as NextRequest;
}

function createSupabaseClient() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({
        data: { id: "brand-1", company_id: "company-1" },
        error: null,
      })),
    })),
  };
}

describe("Meta OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv(
      "META_REDIRECT_URI",
      "https://1wayseo.com/api/social/meta/callback",
    );

    createClientMock.mockResolvedValue(createSupabaseClient());
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        upsert: upsertMock.mockResolvedValue({ error: null }),
      })),
    });
    exchangeCodeMock.mockResolvedValue({
      access_token: "short-user-token",
      expires_in: 3600,
    });
    exchangeLongMock.mockResolvedValue({
      access_token: "long-user-token",
      expires_in: 60 * 24 * 60 * 60,
    });
    fetchMeMock.mockResolvedValue({
      id: "fb-user-1",
      name: "Meta User",
      accounts: {
        data: [
          {
            id: "page-1",
            name: "Page One",
          },
          {
            id: "page-2",
            name: "Page Two",
          },
        ],
      },
    });
    fetchPageAccessMock.mockImplementation(async ({ pageId }) => ({
      id: pageId,
      name: pageId === "page-1" ? "Page One" : "Page Two",
      access_token: `${pageId}-token`,
      instagram_business_account:
        pageId === "page-1"
          ? {
              id: "ig-1",
              username: "ig_one",
              name: "IG One",
            }
          : null,
    }));
    fetchThreadsProfileMock.mockResolvedValue({
      id: "threads-1",
      username: "threads_one",
      name: "Threads One",
    });
  });

  it("rejects a callback with a bad state CSRF token", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      createCookieRequest(
        "https://1wayseo.com/api/social/meta/callback?code=code-1&state=bad",
        {
          meta_oauth_state: "expected",
          meta_oauth_brand_id: "brand-1",
        },
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/social?error=invalid_state",
    );
    expect(exchangeCodeMock).not.toHaveBeenCalled();
  });

  it("exchanges code to long-lived token, fetches page tokens, encrypts, and stores accounts", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      createCookieRequest(
        "https://1wayseo.com/api/social/meta/callback?code=code-1&state=state-1",
        {
          meta_oauth_state: "state-1",
          meta_oauth_brand_id: "brand-1",
        },
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/social?connected=meta",
    );
    expect(exchangeCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ code: "code-1" }),
    );
    expect(exchangeLongMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "short-user-token" }),
    );
    expect(fetchPageAccessMock).toHaveBeenCalledTimes(2);
    expect(fetchPageAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "page-1" }),
    );
    expect(tokenCryptoMock.encrypt).toHaveBeenCalledWith("page-1-token");
    expect(tokenCryptoMock.encrypt).toHaveBeenCalledWith(
      JSON.stringify({
        userAccessToken: "long-user-token",
        pageId: "page-1",
      }),
    );
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          brand_id: "brand-1",
          platform: "facebook",
          platform_account_id: "page-1",
          platform_username: "Page One",
          access_token_encrypted: "encrypted:page-1-token",
          refresh_token_encrypted: `encrypted:${JSON.stringify({
            userAccessToken: "long-user-token",
            pageId: "page-1",
          })}`,
          disconnected_at: null,
        }),
        expect.objectContaining({
          brand_id: "brand-1",
          platform: "instagram",
          platform_account_id: "ig-1",
          platform_username: "ig_one",
          access_token_encrypted: "encrypted:page-1-token",
          refresh_token_encrypted: `encrypted:${JSON.stringify({
            userAccessToken: "long-user-token",
            pageId: "page-1",
          })}`,
          disconnected_at: null,
        }),
        expect.objectContaining({
          brand_id: "brand-1",
          platform: "threads",
          platform_account_id: "threads-1",
          platform_username: "threads_one",
          access_token_encrypted: "encrypted:long-user-token",
          refresh_token_encrypted: "encrypted:long-user-token",
          disconnected_at: null,
        }),
      ]),
      { onConflict: "brand_id,platform,platform_account_id" },
    );
  });
});
