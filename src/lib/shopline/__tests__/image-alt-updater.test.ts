import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateShoplineImageAlt } from "../image-alt-updater";
import type { ShoplineConnectionStore } from "../connections";
import type { ShoplineImage } from "../types";

const updateProductImage = vi.fn();

vi.mock("../client", () => ({
  ShoplineClient: vi.fn(function ShoplineClient() {
    return {
      updateProductImage,
    };
  }),
}));

const updatedImage: ShoplineImage = {
  id: "image_1",
  src: "https://img.myshopline.com/example.jpg",
  alt: "Updated alt",
  position: 1,
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

describe("updateShoplineImageAlt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProductImage.mockResolvedValue(updatedImage);
  });

  it("updates the image alt through ShoplineClient and returns the image", async () => {
    const store = createStore();

    const result = await updateShoplineImageAlt(
      "company_1",
      "website_1",
      "product_1",
      "image_1",
      "Updated alt",
      { store },
    );

    expect(result).toEqual(updatedImage);
    expect(store.findConnection).toHaveBeenCalledWith({
      companyId: "company_1",
      websiteId: "website_1",
      status: "active",
    });
    expect(updateProductImage).toHaveBeenCalledWith("product_1", "image_1", {
      alt: "Updated alt",
    });
  });

  it("writes one image alt audit row when the alt changes", async () => {
    const store = createStore();
    const { supabase, from, insert } = createSupabaseAuditClient();

    await updateShoplineImageAlt(
      "company_1",
      "website_1",
      "product_1",
      "image_1",
      "Updated alt",
      {
        store,
        before: { alt: "Old alt" },
        auditOptions: {
          supabase,
          source: "ui",
          userId: "user_1",
          model: "model_1",
        },
      },
    );

    expect(from).toHaveBeenCalledWith("shopline_seo_audit_log");
    expect(insert).toHaveBeenCalledWith([
      {
        company_id: "company_1",
        website_id: "website_1",
        entity_type: "image",
        entity_id: "image_1",
        field: "alt",
        before_value: "Old alt",
        after_value: "Updated alt",
        source: "ui",
        model: "model_1",
        user_id: "user_1",
      },
    ]);
  });

  it("does not write an audit row when the alt is unchanged", async () => {
    const store = createStore();
    const { supabase, insert } = createSupabaseAuditClient();

    await updateShoplineImageAlt(
      "company_1",
      "website_1",
      "product_1",
      "image_1",
      "Same alt",
      {
        store,
        before: { alt: "Same alt" },
        auditOptions: {
          supabase,
          source: "ui",
        },
      },
    );

    expect(insert).not.toHaveBeenCalled();
  });

  it("warns and returns the updated image when audit log insert fails", async () => {
    const store = createStore();
    const insert = vi.fn(async () => ({
      error: { message: "relation does not exist" },
    }));
    const supabase = { from: vi.fn(() => ({ insert })) };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      updateShoplineImageAlt(
        "company_1",
        "website_1",
        "product_1",
        "image_1",
        "Updated alt",
        {
          store,
          before: { alt: "Old alt" },
          auditOptions: {
            supabase,
            source: "ui",
          },
        },
      ),
    ).resolves.toEqual(updatedImage);

    expect(warn).toHaveBeenCalledWith(
      "[shopline-image-alt-updater] audit log insert failed:",
      "relation does not exist",
    );
    warn.mockRestore();
  });
});
