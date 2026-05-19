import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createShoplineRedirect,
  deleteShoplineRedirect,
  listShoplineRedirects,
  type RedirectStoreSupabase,
} from "../redirect-store";

function createInsertStore(error: { message?: string } | null = null) {
  const insert = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ insert }));

  return {
    supabase: { from } as unknown as RedirectStoreSupabase,
    from,
    insert,
  };
}

describe("shopline redirect store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a redirect row with normalized column names", async () => {
    const { supabase, from, insert } = createInsertStore();

    await createShoplineRedirect(supabase, {
      websiteId: "website_1",
      entityType: "product",
      entityId: "product_1",
      handleFrom: "old-product",
      handleTo: "new-product",
    });

    expect(from).toHaveBeenCalledWith("shopline_redirects");
    expect(insert).toHaveBeenCalledWith({
      website_id: "website_1",
      entity_type: "product",
      entity_id: "product_1",
      handle_from: "old-product",
      handle_to: "new-product",
    });
  });

  it("does not insert when handles are identical", async () => {
    const { supabase, insert } = createInsertStore();

    await createShoplineRedirect(supabase, {
      websiteId: "website_1",
      entityType: "collection",
      handleFrom: "same-handle",
      handleTo: "same-handle",
    });

    expect(insert).not.toHaveBeenCalled();
  });

  it("warns instead of throwing when redirect insert fails", async () => {
    const { supabase } = createInsertStore({
      message: "duplicate key value violates unique constraint",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      createShoplineRedirect(supabase, {
        websiteId: "website_1",
        entityType: "product",
        handleFrom: "old-product",
        handleTo: "new-product",
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      "[shopline-redirect-store] redirect insert failed:",
      "duplicate key value violates unique constraint",
    );
    warn.mockRestore();
  });

  it("lists redirects ordered by newest first", async () => {
    const rows = [
      {
        id: "redirect_1",
        website_id: "website_1",
        entity_type: "product",
        entity_id: "product_1",
        handle_from: "old-product",
        handle_to: "new-product",
        created_at: "2026-05-20T00:00:00.000Z",
        last_hit_at: null,
        hit_count: 3,
      },
    ];
    const order = vi.fn(async () => ({ data: rows, error: null }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const supabase = { from } as unknown as RedirectStoreSupabase;

    const result = await listShoplineRedirects(supabase, "website_1");

    expect(from).toHaveBeenCalledWith("shopline_redirects");
    expect(select).toHaveBeenCalledWith(
      "id, website_id, entity_type, entity_id, handle_from, handle_to, created_at, last_hit_at, hit_count",
    );
    expect(eq).toHaveBeenCalledWith("website_id", "website_1");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(rows);
  });

  it("deletes a redirect by id", async () => {
    const eq = vi.fn(async () => ({ error: null }));
    const deleteFn = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ delete: deleteFn }));
    const supabase = { from } as unknown as RedirectStoreSupabase;

    await deleteShoplineRedirect(supabase, "redirect_1");

    expect(from).toHaveBeenCalledWith("shopline_redirects");
    expect(deleteFn).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", "redirect_1");
  });
});
