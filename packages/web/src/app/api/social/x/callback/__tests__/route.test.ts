import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  exchangeAuthorizationCodeForXTokensMock,
  fetchXUserMeMock,
  tokenCryptoMock,
} = vi.hoisted(() => ({
  exchangeAuthorizationCodeForXTokensMock: vi.fn(),
  fetchXUserMeMock: vi.fn(),
  tokenCryptoMock: {
    encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
    decrypt: vi.fn(),
  },
}));

vi.mock("@/lib/social/token-crypto", () => ({
  getSocialTokenCrypto: vi.fn(() => tokenCryptoMock),
}));

vi.mock("@/lib/social/x/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social/x/oauth")>();
  return {
    ...actual,
    exchangeAuthorizationCodeForXTokens:
      exchangeAuthorizationCodeForXTokensMock,
    fetchXUserMe: fetchXUserMeMock,
  };
});

const { createAdminClientMock, createClientMock, upsertMock } = vi.hoisted(
  () => ({
    createAdminClientMock: vi.fn(),
    createClientMock: vi.fn(),
    upsertMock: vi.fn(),
  }),
);

vi.mock("@shared/supabase", () => ({
  createAdminClient: createAdminClientMock,
  createClient: createClientMock,
}));

function createCookieRequest(
  url: string,
  cookies: Record<string, string>,
): NextRequest {
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

describe("X OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("X_CLIENT_ID", "x-client-id");
    vi.stubEnv("X_CLIENT_SECRET", "x-client-secret");
    vi.stubEnv("X_REDIRECT_URI", "https://1wayseo.com/api/social/x/callback");

    createClientMock.mockResolvedValue(createSupabaseClient());
    createAdminClientMock.mockReturnValue({
      from: vi.fn(() => ({
        upsert: upsertMock.mockResolvedValue({ error: null }),
      })),
    });
    exchangeAuthorizationCodeForXTokensMock.mockResolvedValue({
      access_token: "x-access-token",
      refresh_token: "x-refresh-token",
      expires_in: 7200,
      scope: "tweet.read tweet.write users.read offline.access",
      token_type: "bearer",
    });
    fetchXUserMeMock.mockResolvedValue({
      id: "x-user-id",
      username: "onewayseo",
    });
  });

  it("rejects a callback with a bad state CSRF token", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      createCookieRequest(
        "https://1wayseo.com/api/social/x/callback?code=code-1&state=bad",
        {
          x_oauth_state: "expected",
          x_oauth_code_verifier: "verifier",
          x_oauth_brand_id: "brand-1",
        },
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/social?error=invalid_state",
    );
    expect(exchangeAuthorizationCodeForXTokensMock).not.toHaveBeenCalled();
  });

  it("rejects a callback when the PKCE code verifier cookie is missing", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      createCookieRequest(
        "https://1wayseo.com/api/social/x/callback?code=code-1&state=state-1",
        {
          x_oauth_state: "state-1",
          x_oauth_brand_id: "brand-1",
        },
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/social?error=missing_code_verifier",
    );
    expect(exchangeAuthorizationCodeForXTokensMock).not.toHaveBeenCalled();
  });

  it("encrypts X tokens before inserting the social account row", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      createCookieRequest(
        "https://1wayseo.com/api/social/x/callback?code=code-1&state=state-1",
        {
          x_oauth_state: "state-1",
          x_oauth_code_verifier: "verifier-1",
          x_oauth_brand_id: "brand-1",
        },
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://1wayseo.com/dashboard/social?connected=x",
    );
    expect(tokenCryptoMock.encrypt).toHaveBeenCalledWith("x-access-token");
    expect(tokenCryptoMock.encrypt).toHaveBeenCalledWith("x-refresh-token");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        brand_id: "brand-1",
        platform: "x",
        platform_account_id: "x-user-id",
        platform_username: "onewayseo",
        access_token_encrypted: "encrypted:x-access-token",
        refresh_token_encrypted: "encrypted:x-refresh-token",
        disconnected_at: null,
      }),
      { onConflict: "brand_id,platform,platform_account_id" },
    );
  });
});
