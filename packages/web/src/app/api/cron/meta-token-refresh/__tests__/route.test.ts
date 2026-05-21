import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshExpiringMetaTokensMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/social/meta/refresh", () => ({
  refreshExpiringMetaTokens: refreshExpiringMetaTokensMock,
}));

function request(token: string) {
  return {
    headers: new Headers({ authorization: `Bearer ${token}` }),
  };
}

describe("Meta token refresh cron route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = "cron-secret";
    refreshExpiringMetaTokensMock.mockResolvedValue({
      checked: 1,
      refreshed: 1,
      failed: 0,
    });
  });

  it("refreshes expiring Meta tokens when cron auth passes", async () => {
    const { GET } = await import("../route");

    const response = await GET(request("cron-secret") as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      result: { checked: 1, refreshed: 1, failed: 0 },
    });
    expect(refreshExpiringMetaTokensMock).toHaveBeenCalledOnce();
  });
});
