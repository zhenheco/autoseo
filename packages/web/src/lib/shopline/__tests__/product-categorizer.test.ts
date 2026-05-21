import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateShoplineProductCategories } from "../product-categorizer";
import type { ShoplineConnectionStore } from "../connections";

const listProductCollects = vi.fn();
const assignProductToCollection = vi.fn();
const removeProductFromCollection = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      listProductCollects,
      assignProductToCollection,
      removeProductFromCollection,
    };
  }),
}));

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
      granted_scopes: ["read_products", "write_products", "write_content"],
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

describe("updateShoplineProductCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProductCollects.mockResolvedValue({
      collects: [
        {
          id: "collect_remove_1",
          collection_id: "collection_remove_1",
          product_id: "product_1",
        },
      ],
    });
    assignProductToCollection.mockImplementation(
      async (productId: string, collectionId: string) => ({
        id: `collect_${collectionId}`,
        collection_id: collectionId,
        product_id: productId,
      }),
    );
    removeProductFromCollection.mockResolvedValue(undefined);
  });

  it("assigns and removes product collections successfully", async () => {
    const result = await updateShoplineProductCategories(
      "company_1",
      "website_1",
      "product_1",
      {
        add: ["collection_add_1"],
        remove: ["collection_remove_1"],
      },
      { store: createStore() },
    );

    expect(listProductCollects).toHaveBeenCalledWith("product_1");
    expect(assignProductToCollection).toHaveBeenCalledWith(
      "product_1",
      "collection_add_1",
    );
    expect(removeProductFromCollection).toHaveBeenCalledWith(
      "collect_remove_1",
    );
    expect(result).toEqual({
      added: [{ collection_id: "collection_add_1", success: true }],
      removed: [{ collection_id: "collection_remove_1", success: true }],
    });
  });

  it("returns partial failure details when client methods throw", async () => {
    assignProductToCollection.mockImplementation(
      async (_productId: string, collectionId: string) => {
        if (collectionId === "collection_add_fail") {
          throw new Error("assign failed");
        }
        return {
          id: `collect_${collectionId}`,
          collection_id: collectionId,
          product_id: "product_1",
        };
      },
    );
    removeProductFromCollection.mockRejectedValueOnce(
      new Error("remove failed"),
    );

    const result = await updateShoplineProductCategories(
      "company_1",
      "website_1",
      "product_1",
      {
        add: ["collection_add_ok", "collection_add_fail"],
        remove: ["collection_remove_1"],
      },
      { store: createStore() },
    );

    expect(result).toEqual({
      added: [
        { collection_id: "collection_add_ok", success: true },
        {
          collection_id: "collection_add_fail",
          success: false,
          error: "assign failed",
        },
      ],
      removed: [
        {
          collection_id: "collection_remove_1",
          success: false,
          error: "remove failed",
        },
      ],
    });
  });

  it("throws shopline_no_connection when no active connection exists", async () => {
    await expect(
      updateShoplineProductCategories(
        "company_1",
        "website_1",
        "product_1",
        { add: ["collection_1"], remove: [] },
        {
          store: createStore({
            findConnection: vi.fn(async () => null),
          }),
        },
      ),
    ).rejects.toThrow("shopline_no_connection");
  });

  it("writes one audit row per successful assignment change", async () => {
    const { supabase, from, insert } = createSupabaseAuditClient();

    await updateShoplineProductCategories(
      "company_1",
      "website_1",
      "product_1",
      {
        add: ["collection_add_1"],
        remove: ["collection_remove_1"],
      },
      {
        store: createStore(),
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
        entity_type: "category_assignment",
        entity_id: "product_1",
        field: "collection_id",
        before_value: null,
        after_value: "collection_add_1",
        source: "ui",
        model: null,
        user_id: "user_1",
      },
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "category_assignment",
        entity_id: "product_1",
        field: "collection_id",
        before_value: "collection_remove_1",
        after_value: null,
        source: "ui",
        model: null,
        user_id: "user_1",
      },
    ]);
  });

  it("warns but does not throw when audit insert fails", async () => {
    const insert = vi.fn(async () => ({
      error: { message: "relation does not exist" },
    }));
    const supabase = { from: vi.fn(() => ({ insert })) };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      updateShoplineProductCategories(
        "company_1",
        "website_1",
        "product_1",
        { add: ["collection_add_1"], remove: [] },
        {
          store: createStore(),
          auditOptions: {
            supabase,
            source: "ui",
          },
        },
      ),
    ).resolves.toEqual({
      added: [{ collection_id: "collection_add_1", success: true }],
      removed: [],
    });

    expect(warn).toHaveBeenCalledWith(
      "[shopline-product-categorizer] audit log insert failed:",
      "relation does not exist",
    );
    warn.mockRestore();
  });
});
