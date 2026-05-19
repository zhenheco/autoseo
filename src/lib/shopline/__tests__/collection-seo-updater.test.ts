import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateShoplineCollectionSeo } from "../collection-seo-updater";
import type { ShoplineConnectionStore } from "../connections";
import type { ShoplineCollection } from "../types";

const updateCollection = vi.fn();
const getCollection = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      getCollection,
      updateCollection,
    };
  }),
}));

const updatedCollection: ShoplineCollection = {
  id: "collection_1",
  title: "Updated Collection",
  handle: "updated-collection",
  body_html: "",
  products_count: 12,
  updated_at: "2026-05-19T00:00:00.000Z",
  seo: {
    title: "Updated SEO title",
    description: "Updated SEO description",
  },
};

const currentCollection: ShoplineCollection = {
  ...updatedCollection,
  title: "Old Collection",
  handle: "old-collection",
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
      granted_scopes: ["read_products", "write_content"],
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

describe("updateShoplineCollectionSeo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollection.mockResolvedValue(currentCollection);
  });

  it("updates seo.title and returns the updated collection", async () => {
    const store = createStore();
    updateCollection.mockResolvedValueOnce(updatedCollection);

    const result = await updateShoplineCollectionSeo(
      "company_1",
      "website_1",
      "collection_1",
      {
        seo: { title: "Updated SEO title" },
      },
      { store },
    );

    expect(result).toEqual(updatedCollection);
    expect(store.findConnection).toHaveBeenCalledWith({
      companyId: "company_1",
      websiteId: "website_1",
      status: "active",
    });
    expect(updateCollection).toHaveBeenCalledWith("collection_1", {
      seo: { title: "Updated SEO title" },
    });
  });

  it("throws shopline_update_collection_no_fields for an empty patch", async () => {
    const store = createStore();

    await expect(
      updateShoplineCollectionSeo(
        "company_1",
        "website_1",
        "collection_1",
        {},
        { store },
      ),
    ).rejects.toThrow("shopline_update_collection_no_fields");
    expect(updateCollection).not.toHaveBeenCalled();
  });

  it("throws shopline_no_connection when no active connection exists", async () => {
    const store = createStore({
      findConnection: vi.fn(async () => null),
    });

    await expect(
      updateShoplineCollectionSeo(
        "company_1",
        "website_1",
        "collection_1",
        { seo: { title: "Updated SEO title" } },
        { store },
      ),
    ).rejects.toThrow("shopline_no_connection");
  });

  it("writes audit rows for every changed collection field", async () => {
    const store = createStore();
    const { supabase, from, insert } = createSupabaseAuditClient();
    updateCollection.mockResolvedValueOnce(updatedCollection);

    await updateShoplineCollectionSeo(
      "company_1",
      "website_1",
      "collection_1",
      {
        seo: {
          title: "Updated SEO title",
          description: "Updated SEO description",
        },
        handle: "updated-collection",
        title: "Updated Collection",
      },
      {
        store,
        auditOptions: {
          supabase,
          source: "ui",
          userId: "user_1",
          model: "gpt-test",
        },
      },
    );

    expect(getCollection).toHaveBeenCalledWith("collection_1");
    expect(from).toHaveBeenCalledWith("shopline_seo_audit_log");
    expect(insert).toHaveBeenCalledWith([
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "collection",
        entity_id: "collection_1",
        field: "seo.title",
        before_value: "Old SEO title",
        after_value: "Updated SEO title",
        source: "ui",
        model: "gpt-test",
        user_id: "user_1",
      },
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "collection",
        entity_id: "collection_1",
        field: "seo.description",
        before_value: "Old SEO description",
        after_value: "Updated SEO description",
        source: "ui",
        model: "gpt-test",
        user_id: "user_1",
      },
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "collection",
        entity_id: "collection_1",
        field: "handle",
        before_value: "old-collection",
        after_value: "updated-collection",
        source: "ui",
        model: "gpt-test",
        user_id: "user_1",
      },
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "collection",
        entity_id: "collection_1",
        field: "title",
        before_value: "Old Collection",
        after_value: "Updated Collection",
        source: "ui",
        model: "gpt-test",
        user_id: "user_1",
      },
    ]);
  });

  it("uses a provided before snapshot for audit rows", async () => {
    const store = createStore();
    const { supabase, insert } = createSupabaseAuditClient();
    updateCollection.mockResolvedValueOnce(updatedCollection);

    await updateShoplineCollectionSeo(
      "company_1",
      "website_1",
      "collection_1",
      { handle: "updated-collection" },
      {
        store,
        before: { handle: "manual-before" },
        auditOptions: {
          supabase,
          source: "cli",
        },
      },
    );

    expect(getCollection).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        field: "handle",
        before_value: "manual-before",
        after_value: "updated-collection",
        source: "cli",
      }),
    ]);
  });

  it("warns and returns the updated collection when audit log insert fails", async () => {
    const store = createStore();
    const insert = vi.fn(async () => ({
      error: { message: "relation does not exist" },
    }));
    const from = vi.fn(() => ({ insert }));
    const supabase = { from };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    updateCollection.mockResolvedValueOnce(updatedCollection);

    await expect(
      updateShoplineCollectionSeo(
        "company_1",
        "website_1",
        "collection_1",
        { seo: { title: "Updated SEO title" } },
        {
          store,
          auditOptions: {
            supabase,
            source: "ui",
          },
        },
      ),
    ).resolves.toEqual(updatedCollection);

    expect(warn).toHaveBeenCalledWith(
      "[shopline-collection-seo-updater] audit log insert failed:",
      "relation does not exist",
    );
    warn.mockRestore();
  });

  it("does not write an audit row when a patched field is unchanged", async () => {
    const store = createStore();
    const { supabase, insert } = createSupabaseAuditClient();
    updateCollection.mockResolvedValueOnce({
      ...updatedCollection,
      handle: "old-collection",
    });

    await updateShoplineCollectionSeo(
      "company_1",
      "website_1",
      "collection_1",
      { handle: "old-collection" },
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
