import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShoplineCollections } from "../collection-fetcher";
import type { ShoplineConnectionStore } from "../connections";
import type { ShoplineCollection } from "../types";

const listCollections = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      listCollections,
    };
  }),
}));

function collection(id: number): ShoplineCollection {
  return {
    id: String(id),
    title: `Collection ${id}`,
    handle: `collection-${id}`,
    body_html: "",
    seo: { title: `SEO ${id}` },
    products_count: id,
    updated_at: "2026-05-19T00:00:00.000Z",
  };
}

function createStore(overrides: Partial<ShoplineConnectionStore> = {}) {
  return {
    encryptToken: vi.fn(),
    decryptToken: vi.fn(async () => "token-123"),
    upsertConnection: vi.fn(),
    findConnection: vi.fn(async () => ({
      id: "conn_1",
      company_id: "company_1",
      website_id: "website_1",
      shop_handle: "demo-shop",
      shop_domain: "demo-shop.myshopline.com",
      access_token_encrypted: "encrypted-token",
      granted_scopes: ["read_products", "write_content"],
      status: "active" as const,
      last_verified_at: null,
      updated_at: null,
    })),
    ...overrides,
  } satisfies ShoplineConnectionStore;
}

describe("fetchShoplineCollections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 50 collections and the next cursor when present", async () => {
    const store = createStore();
    const collections = Array.from({ length: 50 }, (_, index) =>
      collection(index + 1),
    );
    listCollections.mockResolvedValueOnce({
      collections,
      next: { pageInfo: "cursor-next" },
    });

    const result = await fetchShoplineCollections(
      "company_1",
      "website_1",
      "cursor-1",
      { store },
    );

    expect(result).toEqual({ collections, nextCursor: "cursor-next" });
    expect(store.findConnection).toHaveBeenCalledWith({
      companyId: "company_1",
      websiteId: "website_1",
      status: "active",
    });
    expect(listCollections).toHaveBeenCalledWith({
      pageInfo: "cursor-1",
      limit: 50,
    });
  });

  it("throws shopline_no_connection when no active connection exists", async () => {
    const store = createStore({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      fetchShoplineCollections("company_1", "website_1", null, { store }),
    ).rejects.toThrow("shopline_no_connection");
  });

  it("uses the first page when cursor is absent", async () => {
    const store = createStore();
    listCollections.mockResolvedValueOnce({
      collections: [collection(1)],
      next: undefined,
    });

    const result = await fetchShoplineCollections(
      "company_1",
      "website_1",
      null,
      { store },
    );

    expect(result.nextCursor).toBeNull();
    expect(listCollections).toHaveBeenCalledWith({ limit: 50 });
  });
});
