import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchShoplineProducts } from "../product-fetcher";
import type { ShoplineConnectionStore } from "../connections";
import type { ShoplineProduct } from "../types";

const listProducts = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      listProducts,
    };
  }),
}));

function product(id: number): ShoplineProduct {
  return {
    id: String(id),
    title: `Product ${id}`,
    handle: `product-${id}`,
    product_type: "",
    vendor: "",
    status: "active",
    tags: "",
    images: [],
    variants: [],
    created_at: "2026-05-19T00:00:00.000Z",
    updated_at: "2026-05-19T00:00:00.000Z",
    seo: { title: `SEO ${id}` },
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
      granted_scopes: ["read_products", "write_products"],
      status: "active" as const,
      last_verified_at: null,
      updated_at: null,
    })),
    ...overrides,
  } satisfies ShoplineConnectionStore;
}

describe("fetchShoplineProducts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 50 products and the next cursor when present", async () => {
    const store = createStore();
    const products = Array.from({ length: 50 }, (_, index) =>
      product(index + 1),
    );
    listProducts.mockResolvedValueOnce({
      products,
      next: { pageInfo: "cursor-next" },
    });

    const result = await fetchShoplineProducts(
      "company_1",
      "website_1",
      "cursor-1",
      { store },
    );

    expect(result).toEqual({ products, nextCursor: "cursor-next" });
    expect(store.findConnection).toHaveBeenCalledWith({
      companyId: "company_1",
      websiteId: "website_1",
      status: "active",
    });
    expect(listProducts).toHaveBeenCalledWith({
      pageInfo: "cursor-1",
      limit: 50,
    });
  });

  it("throws shopline_no_connection when no active connection exists", async () => {
    const store = createStore({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      fetchShoplineProducts("company_1", "website_1", undefined, { store }),
    ).rejects.toThrow("shopline_no_connection");
  });

  it("uses the first page when cursor is absent", async () => {
    const store = createStore();
    listProducts.mockResolvedValueOnce({
      products: [product(1)],
      next: undefined,
    });

    const result = await fetchShoplineProducts(
      "company_1",
      "website_1",
      undefined,
      { store },
    );

    expect(result.nextCursor).toBeUndefined();
    expect(listProducts).toHaveBeenCalledWith({ limit: 50 });
  });
});
