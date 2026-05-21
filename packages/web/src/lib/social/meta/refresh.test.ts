import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshExpiringMetaTokens, refreshMetaToken } from "./refresh";

const { exchangeLongMock, fetchPageAccessMock } = vi.hoisted(() => ({
  exchangeLongMock: vi.fn(),
  fetchPageAccessMock: vi.fn(),
}));

vi.mock("./oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/social/meta/oauth")>();
  return {
    ...actual,
    exchangeMetaTokenForLongLivedToken: exchangeLongMock,
    fetchMetaPageAccess: fetchPageAccessMock,
  };
});

function createRefreshSupabaseMock() {
  const updateMock = vi.fn().mockReturnThis();
  const eqMock = vi.fn().mockReturnThis();

  const accountBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "account-1",
        platform: "facebook",
        platform_account_id: "page-1",
        access_token_encrypted: "encrypted-old-access-token",
        refresh_token_encrypted: "encrypted-old-refresh-source",
      },
      error: null,
    })),
  };
  const updateBuilder = {
    update: updateMock,
    eq: eqMock,
  };

  return {
    updateMock,
    eqMock,
    client: {
      from: vi
        .fn()
        .mockReturnValueOnce(accountBuilder)
        .mockReturnValueOnce(updateBuilder),
    },
  };
}

describe("refreshMetaToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("META_APP_ID", "meta-app-id");
    vi.stubEnv("META_APP_SECRET", "meta-app-secret");
    exchangeLongMock.mockResolvedValue({
      access_token: "new-long-token",
      expires_in: 60 * 24 * 60 * 60,
    });
    fetchPageAccessMock.mockResolvedValue({
      id: "page-1",
      name: "Page One",
      access_token: "new-page-token",
    });
  });

  it("re-exchanges the stored long-lived token and updates a page-scoped account", async () => {
    const supabase = createRefreshSupabaseMock();
    const tokenCrypto = {
      decrypt: vi.fn(async () =>
        JSON.stringify({
          userAccessToken: "old-user-token",
          pageId: "page-1",
        }),
      ),
      encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
    };

    const result = await refreshMetaToken("account-1", {
      supabase: supabase.client as never,
      tokenCrypto,
    });

    expect(result.accessToken).toBe("new-page-token");
    expect(tokenCrypto.decrypt).toHaveBeenCalledWith(
      "encrypted-old-refresh-source",
    );
    expect(exchangeLongMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "old-user-token" }),
    );
    expect(fetchPageAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: "page-1",
        userAccessToken: "new-long-token",
      }),
    );
    expect(supabase.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token_encrypted: "encrypted:new-page-token",
        refresh_token_encrypted: `encrypted:${JSON.stringify({
          userAccessToken: "new-long-token",
          pageId: "page-1",
        })}`,
        disconnected_at: null,
      }),
    );
  });
});

describe("refreshExpiringMetaTokens", () => {
  it("refreshes Meta-family accounts expiring within the threshold", async () => {
    const accountBuilder = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      limit: vi.fn(async () => ({
        data: [{ id: "account-1" }, { id: "account-2" }],
        error: null,
      })),
    };
    const supabase = {
      from: vi.fn(() => accountBuilder),
    };
    const refreshImpl = vi.fn(async () => ({
      accessToken: "new-token",
      expiresAt: new Date().toISOString(),
    }));

    const result = await refreshExpiringMetaTokens({
      supabase: supabase as never,
      refreshImpl,
      now: new Date("2026-05-22T00:00:00.000Z"),
    });

    expect(result).toEqual({ checked: 2, refreshed: 2, failed: 0 });
    expect(accountBuilder.in).toHaveBeenCalledWith("platform", [
      "facebook",
      "instagram",
      "threads",
    ]);
    expect(accountBuilder.lt).toHaveBeenCalledWith(
      "token_expires_at",
      "2026-05-29T00:00:00.000Z",
    );
    expect(refreshImpl).toHaveBeenCalledWith("account-1", expect.any(Object));
    expect(refreshImpl).toHaveBeenCalledWith("account-2", expect.any(Object));
  });
});
