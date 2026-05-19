import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateShoplineProductSeo } from "../seo-updater";
import type { ShoplineConnectionStore } from "../connections";
import type { ShoplineProduct } from "../types";

const updateProduct = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      updateProduct,
    };
  }),
}));

const updatedProduct: ShoplineProduct = {
  id: "product_1",
  title: "Product 1",
  handle: "product-1",
  product_type: "",
  vendor: "",
  status: "active",
  tags: "",
  images: [],
  variants: [],
  created_at: "2026-05-19T00:00:00.000Z",
  updated_at: "2026-05-19T00:00:00.000Z",
  seo: { title: "Updated SEO title" },
};

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
      status: "active",
      last_verified_at: null,
      updated_at: null,
    })),
    ...overrides,
  } satisfies ShoplineConnectionStore;
}

describe("updateShoplineProductSeo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates seo.title and returns the updated product", async () => {
    const store = createStore();
    updateProduct.mockResolvedValueOnce(updatedProduct);

    const result = await updateShoplineProductSeo(
      "company_1",
      "website_1",
      "product_1",
      {
        seo: { title: "Updated SEO title" },
        source: "ui",
      },
      { store },
    );

    expect(result).toEqual(updatedProduct);
    expect(store.findConnection).toHaveBeenCalledWith({
      companyId: "company_1",
      websiteId: "website_1",
      status: "active",
    });
    expect(updateProduct).toHaveBeenCalledWith("product_1", {
      seo: { title: "Updated SEO title" },
    });
  });

  it("throws shopline_update_product_no_fields for an empty patch", async () => {
    const store = createStore();

    await expect(
      updateShoplineProductSeo(
        "company_1",
        "website_1",
        "product_1",
        { source: "cli" },
        { store },
      ),
    ).rejects.toThrow("shopline_update_product_no_fields");
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("throws shopline_no_connection when no active connection exists", async () => {
    const store = createStore({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      updateShoplineProductSeo(
        "company_1",
        "website_1",
        "product_1",
        { seo: { title: "Updated SEO title" } },
        { store },
      ),
    ).rejects.toThrow("shopline_no_connection");
  });
});
