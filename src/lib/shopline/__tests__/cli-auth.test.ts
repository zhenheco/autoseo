import { describe, expect, it, vi } from "vitest";
import { resolveShoplineCliAuth, type ShoplineCliAuthStore } from "../cli-auth";

function store(): ShoplineCliAuthStore {
  return {
    resolveConnectionToken: vi.fn(async () => ({
      shopHandle: "connected-shop",
      accessToken: "connection-token",
      grantedScopes: ["read_products"],
    })),
  };
}

describe("SHOPLINE CLI auth resolution", () => {
  it("uses explicit env token first", async () => {
    const fakeStore = store();

    const result = await resolveShoplineCliAuth({
      args: {},
      env: {
        SHOPLINE_SHOP_HANDLE: "env-shop",
        SHOPLINE_ACCESS_TOKEN: "env-token",
      },
      store: fakeStore,
    });

    expect(result).toEqual({
      shopHandle: "env-shop",
      accessToken: "env-token",
      source: "env",
    });
    expect(fakeStore.resolveConnectionToken).not.toHaveBeenCalled();
  });

  it("resolves SaaS connection tokens by company and website", async () => {
    const fakeStore = store();

    const result = await resolveShoplineCliAuth({
      args: {
        "company-id": "company-1",
        "website-id": "website-1",
      },
      env: {},
      store: fakeStore,
    });

    expect(fakeStore.resolveConnectionToken).toHaveBeenCalledWith({
      companyId: "company-1",
      websiteId: "website-1",
    });
    expect(result).toEqual({
      shopHandle: "connected-shop",
      accessToken: "connection-token",
      source: "connection",
    });
  });

  it("resolves SaaS connection tokens by company and shop handle", async () => {
    const fakeStore = store();

    await resolveShoplineCliAuth({
      args: {
        "company-id": "company-1",
        "shop-handle": "demo-shop",
      },
      env: {},
      store: fakeStore,
    });

    expect(fakeStore.resolveConnectionToken).toHaveBeenCalledWith({
      companyId: "company-1",
      shopHandle: "demo-shop",
    });
  });

  it("fails clearly when neither env nor connection identifiers are available", async () => {
    await expect(
      resolveShoplineCliAuth({
        args: {},
        env: {},
        store: store(),
      }),
    ).rejects.toThrow("shopline_cli_auth_required");
  });
});
