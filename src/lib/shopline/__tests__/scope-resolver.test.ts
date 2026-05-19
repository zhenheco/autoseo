import { describe, expect, it, vi } from "vitest";
import { getGrantedScopes } from "../scope-resolver";
import type { ShoplineConnectionStore } from "../connections";

function createStore(
  overrides: Partial<ShoplineConnectionStore> = {},
): ShoplineConnectionStore {
  return {
    encryptToken: vi.fn(),
    decryptToken: vi.fn(),
    upsertConnection: vi.fn(),
    findConnection: vi.fn(async () => ({
      id: "conn-1",
      company_id: "company-1",
      website_id: "website-1",
      shop_handle: "demo-shop",
      shop_domain: "demo-shop.myshopline.com",
      access_token_encrypted: "encrypted-token",
      granted_scopes: ["read_products", "write_products"],
      status: "active" as const,
      last_verified_at: null,
      updated_at: null,
    })),
    ...overrides,
  };
}

describe("getGrantedScopes", () => {
  it("returns granted_scopes from an active owned connection", async () => {
    const store = createStore();

    await expect(
      getGrantedScopes(store, {
        companyId: "company-1",
        websiteId: "website-1",
      }),
    ).resolves.toEqual(["read_products", "write_products"]);

    expect(store.findConnection).toHaveBeenCalledWith({
      companyId: "company-1",
      websiteId: "website-1",
      status: "active",
    });
  });

  it("returns an empty array when granted_scopes is missing", async () => {
    const store = createStore({
      findConnection: vi.fn(async () => ({
        id: "conn-1",
        company_id: "company-1",
        website_id: "website-1",
        shop_handle: "demo-shop",
        shop_domain: "demo-shop.myshopline.com",
        access_token_encrypted: "encrypted-token",
        granted_scopes: undefined as unknown as string[],
        status: "active" as const,
        last_verified_at: null,
        updated_at: null,
      })),
    });

    await expect(
      getGrantedScopes(store, {
        companyId: "company-1",
        websiteId: "website-1",
      }),
    ).resolves.toEqual([]);
  });

  it("throws shopline_no_connection when no active connection exists", async () => {
    const store = createStore({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      getGrantedScopes(store, {
        companyId: "company-1",
        websiteId: "website-1",
      }),
    ).rejects.toThrow("shopline_no_connection");
  });
});
