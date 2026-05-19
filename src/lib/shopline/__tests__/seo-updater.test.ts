import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateShoplineProductSeo } from "../seo-updater";
import type { ShoplineConnectionStore } from "../connections";
import type { ShoplineProduct } from "../types";

const updateProduct = vi.fn();
const getProduct = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      getProduct,
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

const currentProduct: ShoplineProduct = {
  ...updatedProduct,
  handle: "old-product-1",
  seo: {
    title: "Old SEO title",
    description: "Old SEO description",
  },
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
      status: "active" as const,
      last_verified_at: null,
      updated_at: null,
    })),
    ...overrides,
  } satisfies ShoplineConnectionStore;
}

function createSupabaseAuditClient() {
  const insert = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => ({ insert }));

  return {
    supabase: { from },
    from,
    insert,
  };
}

describe("updateShoplineProductSeo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProduct.mockResolvedValue(currentProduct);
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

  it("writes one audit row when seo.title changes", async () => {
    const store = createStore();
    const { supabase, from, insert } = createSupabaseAuditClient();
    updateProduct.mockResolvedValueOnce(updatedProduct);

    await updateShoplineProductSeo(
      "company_1",
      "website_1",
      "product_1",
      { seo: { title: "Updated SEO title" } },
      {
        store,
        auditOptions: {
          supabase,
          source: "ui",
          userId: "user_1",
        },
      },
    );

    expect(from).toHaveBeenCalledWith("shopline_seo_audit_log");
    expect(insert).toHaveBeenCalledWith([
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "product",
        entity_id: "product_1",
        field: "seo.title",
        before_value: "Old SEO title",
        after_value: "Updated SEO title",
        source: "ui",
        model: null,
        user_id: "user_1",
      },
    ]);
  });

  it("writes one audit row when handle changes", async () => {
    const store = createStore();
    const { supabase, insert } = createSupabaseAuditClient();
    updateProduct.mockResolvedValueOnce({
      ...updatedProduct,
      handle: "new-product-1",
    });

    await updateShoplineProductSeo(
      "company_1",
      "website_1",
      "product_1",
      { handle: "new-product-1" },
      {
        store,
        auditOptions: {
          supabase,
          source: "ui",
        },
      },
    );

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        field: "handle",
        before_value: "old-product-1",
        after_value: "new-product-1",
      }),
    ]);
  });

  it("writes one audit row when seo.description changes", async () => {
    const store = createStore();
    const { supabase, insert } = createSupabaseAuditClient();
    updateProduct.mockResolvedValueOnce({
      ...updatedProduct,
      seo: {
        title: "Old SEO title",
        description: "New SEO description",
      },
    });

    await updateShoplineProductSeo(
      "company_1",
      "website_1",
      "product_1",
      { seo: { description: "New SEO description" } },
      {
        store,
        auditOptions: {
          supabase,
          source: "ui",
        },
      },
    );

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        field: "seo.description",
        before_value: "Old SEO description",
        after_value: "New SEO description",
      }),
    ]);
  });

  it("warns and returns the updated product when audit log insert fails", async () => {
    const store = createStore();
    const insert = vi.fn(async () => ({
      error: { message: "relation does not exist" },
    }));
    const from = vi.fn(() => ({ insert }));
    const supabase = { from };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    updateProduct.mockResolvedValueOnce(updatedProduct);

    await expect(
      updateShoplineProductSeo(
        "company_1",
        "website_1",
        "product_1",
        { seo: { title: "Updated SEO title" } },
        {
          store,
          auditOptions: {
            supabase,
            source: "ui",
          },
        },
      ),
    ).resolves.toEqual(updatedProduct);

    expect(warn).toHaveBeenCalledWith(
      "[shopline-seo-updater] audit log insert failed:",
      "relation does not exist",
    );
    warn.mockRestore();
  });

  it("does not write audit rows when audit options are omitted", async () => {
    const store = createStore();
    updateProduct.mockResolvedValueOnce(updatedProduct);

    await updateShoplineProductSeo(
      "company_1",
      "website_1",
      "product_1",
      { seo: { title: "Updated SEO title" } },
      { store },
    );

    expect(getProduct).not.toHaveBeenCalled();
  });

  it("does not write an audit row when a patched field is unchanged", async () => {
    const store = createStore();
    const { supabase, insert } = createSupabaseAuditClient();
    updateProduct.mockResolvedValueOnce({
      ...updatedProduct,
      handle: "old-product-1",
    });

    await updateShoplineProductSeo(
      "company_1",
      "website_1",
      "product_1",
      { handle: "old-product-1" },
      {
        store,
        auditOptions: {
          supabase,
          source: "ui",
        },
      },
    );

    expect(insert).not.toHaveBeenCalled();
  });
});
