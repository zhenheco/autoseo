import { beforeEach, describe, expect, it, vi } from "vitest";

import { refreshXToken } from "./refresh";

function createSupabaseMock() {
  const updateMock = vi.fn().mockReturnThis();
  const eqMock = vi.fn().mockReturnThis();

  const accountBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({
      data: {
        id: "account-1",
        refresh_token_encrypted: "encrypted-old-refresh-token",
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

describe("refreshXToken", () => {
  beforeEach(() => {
    vi.stubEnv("X_CLIENT_ID", "x-client-id");
    vi.stubEnv("X_CLIENT_SECRET", "x-client-secret");
  });

  it("stores a rotated refresh token from X", async () => {
    const supabase = createSupabaseMock();
    const tokenCrypto = {
      decrypt: vi.fn(async () => "old-refresh-token"),
      encrypt: vi.fn(async (value: string) => `encrypted:${value}`),
    };
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 7200,
        scope: "tweet.read tweet.write users.read offline.access",
        token_type: "bearer",
      }),
    }));

    const result = await refreshXToken("account-1", {
      fetchImpl: fetchImpl as never,
      supabase: supabase.client as never,
      tokenCrypto,
    });

    expect(result.accessToken).toBe("new-access-token");
    expect(tokenCrypto.decrypt).toHaveBeenCalledWith(
      "encrypted-old-refresh-token",
    );
    expect(tokenCrypto.encrypt).toHaveBeenCalledWith("new-access-token");
    expect(tokenCrypto.encrypt).toHaveBeenCalledWith("new-refresh-token");
    expect(supabase.updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token_encrypted: "encrypted:new-access-token",
        refresh_token_encrypted: "encrypted:new-refresh-token",
      }),
    );
    expect(supabase.eqMock).toHaveBeenCalledWith("id", "account-1");
  });
});
