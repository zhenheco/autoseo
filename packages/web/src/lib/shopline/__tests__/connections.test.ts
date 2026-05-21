import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseShoplineConnectionStore,
  getShoplineConnectionStatus,
  persistShoplineConnection,
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "../connections";

function store(
  overrides: Partial<ShoplineConnectionStore> = {},
): ShoplineConnectionStore {
  return {
    encryptToken: vi.fn(async () => "encrypted-token"),
    decryptToken: vi.fn(async () => "plain-token"),
    upsertConnection: vi.fn(async (row) => ({
      id: "conn-1",
      company_id: row.company_id,
      website_id: row.website_id,
      shop_handle: row.shop_handle,
      shop_domain: row.shop_domain,
      granted_scopes: row.granted_scopes,
      status: row.status,
      last_verified_at: row.last_verified_at,
      updated_at: row.updated_at,
    })),
    findConnection: vi.fn(async () => null),
    ...overrides,
  };
}

describe("SHOPLINE connection storage", () => {
  it("encrypts access tokens before persistence and never returns token material", async () => {
    const fakeStore = store();

    const result = await persistShoplineConnection(fakeStore, {
      companyId: "company-1",
      websiteId: "website-1",
      shopHandle: "demo-shop",
      accessToken: "raw-token-never-returned",
      scope: "read_products,write_products",
      actorUserId: "user-1",
    });

    expect(fakeStore.encryptToken).toHaveBeenCalledWith(
      "raw-token-never-returned",
    );
    expect(fakeStore.upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "company-1",
        website_id: "website-1",
        shop_handle: "demo-shop",
        shop_domain: "demo-shop.myshopline.com",
        access_token_encrypted: "encrypted-token",
        granted_scopes: ["read_products", "write_products"],
        status: "active" as const,
        created_by: "user-1",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("raw-token-never-returned");
    expect(JSON.stringify(result)).not.toContain("encrypted-token");
  });

  it("reports disconnected status when no owned connection exists", async () => {
    const fakeStore = store({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      getShoplineConnectionStatus(fakeStore, {
        companyId: "company-1",
        websiteId: "website-1",
      }),
    ).resolves.toEqual({ connected: false });
  });

  it("returns connection status without encrypted token fields", async () => {
    const fakeStore = store({
      findConnection: vi.fn(async () => ({
        id: "conn-1",
        company_id: "company-1",
        website_id: "website-1",
        shop_handle: "demo-shop",
        shop_domain: "demo-shop.myshopline.com",
        access_token_encrypted: "encrypted-token",
        granted_scopes: ["read_products"],
        status: "active" as const,
        last_verified_at: "2026-05-18T00:00:00.000Z",
        updated_at: "2026-05-18T00:00:00.000Z",
      })),
    });

    const result = await getShoplineConnectionStatus(fakeStore, {
      companyId: "company-1",
      websiteId: "website-1",
    });

    expect(result).toEqual({
      connected: true,
      shopHandle: "demo-shop",
      shopDomain: "demo-shop.myshopline.com",
      grantedScopes: ["read_products"],
      status: "active",
      lastVerifiedAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("encrypted-token");
  });

  it("decrypts token only after resolving an active owned connection", async () => {
    const fakeStore = store({
      findConnection: vi.fn(async () => ({
        id: "conn-1",
        company_id: "company-1",
        website_id: "website-1",
        shop_handle: "demo-shop",
        shop_domain: "demo-shop.myshopline.com",
        access_token_encrypted: "encrypted-token",
        granted_scopes: ["read_products"],
        status: "active" as const,
        last_verified_at: "2026-05-18T00:00:00.000Z",
        updated_at: "2026-05-18T00:00:00.000Z",
      })),
    });

    const result = await resolveShoplineAccessToken(fakeStore, {
      companyId: "company-1",
      shopHandle: "demo-shop",
    });

    expect(fakeStore.findConnection).toHaveBeenCalledWith({
      companyId: "company-1",
      shopHandle: "demo-shop",
      status: "active",
    });
    expect(fakeStore.decryptToken).toHaveBeenCalledWith("encrypted-token");
    expect(result).toEqual({
      shopHandle: "demo-shop",
      accessToken: "plain-token",
      grantedScopes: ["read_products"],
    });
  });

  it("rejects token resolution for missing or inactive connections", async () => {
    const fakeStore = store({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      resolveShoplineAccessToken(fakeStore, {
        companyId: "company-1",
        shopHandle: "missing-shop",
      }),
    ).rejects.toThrow("shopline_connection_not_found");
  });

  it("uses the existing api_keys encryption key in the Supabase adapter", async () => {
    const rpc = vi.fn(async () => ({ data: "ciphertext", error: null }));
    const adapter = createSupabaseShoplineConnectionStore({
      rpc,
      from: vi.fn(),
    });

    await adapter.encryptToken("plain-token");
    await adapter.decryptToken("ciphertext");

    expect(rpc).toHaveBeenNthCalledWith(1, "encrypt_data", {
      plaintext: "plain-token",
      key_name: "api_keys",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "decrypt_data", {
      ciphertext: "ciphertext",
      key_name: "api_keys",
    });
  });
});
