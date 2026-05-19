import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  getShoplineShopMeta,
  upsertShoplineShopMeta,
} from "../shop-meta-service";

type ShopMetaRow = Database["public"]["Tables"]["shopline_shop_meta"]["Row"];

function shopMetaRow(patch: Partial<ShopMetaRow> = {}): ShopMetaRow {
  return {
    id: "meta-1",
    website_id: "website-1",
    seo_title_template: "{{product.title}} | Demo",
    default_description: "Default description",
    robots_index_products: true,
    robots_index_collections: true,
    sitemap_enabled: true,
    default_og_image: null,
    hreflang_map: null,
    updated_at: "2026-05-20T00:00:00.000Z",
    ...patch,
  };
}

function createSupabaseMock(options?: {
  existing?: ShopMetaRow | null;
  updated?: ShopMetaRow;
  companyId?: string;
  auditError?: { message: string } | null;
}) {
  const state = {
    existing: options?.existing ?? null,
    updated: options?.updated ?? shopMetaRow(),
    companyId: options?.companyId ?? "company-1",
    auditError: options?.auditError ?? null,
  };
  const calls = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
  };

  const supabase = {
    from(table: string) {
      calls.from(table);

      if (table === "shopline_shop_meta") {
        const selectBuilder = {
          select(columns: string) {
            calls.select(columns);
            return selectBuilder;
          },
          eq(column: string, value: unknown) {
            calls.eq(column, value);
            return selectBuilder;
          },
          maybeSingle() {
            calls.maybeSingle();
            return Promise.resolve({ data: state.existing, error: null });
          },
        };

        return {
          ...selectBuilder,
          upsert(row: unknown, optionsArg?: unknown) {
            calls.upsert(row, optionsArg);
            return {
              select(columns: string) {
                calls.select(columns);
                return {
                  single() {
                    calls.single();
                    return Promise.resolve({
                      data: state.updated,
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "website_configs") {
        const builder = {
          select(columns: string) {
            calls.select(columns);
            return builder;
          },
          eq(column: string, value: unknown) {
            calls.eq(column, value);
            return builder;
          },
          maybeSingle() {
            calls.maybeSingle();
            return Promise.resolve({
              data: { company_id: state.companyId },
              error: null,
            });
          },
        };
        return builder;
      }

      if (table === "shopline_seo_audit_log") {
        return {
          insert(rows: unknown) {
            calls.insert(rows);
            return Promise.resolve({ error: state.auditError });
          },
        };
      }

      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient<Database>;

  return { supabase, calls };
}

describe("shop-meta-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets shop meta for a website", async () => {
    const row = shopMetaRow();
    const { supabase, calls } = createSupabaseMock({ existing: row });

    await expect(getShoplineShopMeta(supabase, "website-1")).resolves.toEqual(
      row,
    );
    expect(calls.from).toHaveBeenCalledWith("shopline_shop_meta");
    expect(calls.eq).toHaveBeenCalledWith("website_id", "website-1");
  });

  it("upserts shop meta and writes one audit row per changed field", async () => {
    const existing = shopMetaRow({
      seo_title_template: "{{product.title}}",
      robots_index_products: true,
      hreflang_map: { en: "https://example.com/en" },
    });
    const updated = shopMetaRow({
      seo_title_template: "{{product.title}} | {{shop.name}}",
      robots_index_products: false,
      hreflang_map: { en: "https://example.com/en" },
    });
    const { supabase, calls } = createSupabaseMock({ existing, updated });

    await expect(
      upsertShoplineShopMeta(
        supabase,
        "website-1",
        {
          seo_title_template: "{{product.title}} | {{shop.name}}",
          robots_index_products: false,
          hreflang_map: { en: "https://example.com/en" },
        },
        { userId: "user-1", source: "ui" },
      ),
    ).resolves.toEqual(updated);

    expect(calls.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        website_id: "website-1",
        seo_title_template: "{{product.title}} | {{shop.name}}",
        robots_index_products: false,
        hreflang_map: { en: "https://example.com/en" },
        updated_at: expect.any(String),
      }),
      { onConflict: "website_id" },
    );
    expect(calls.insert).toHaveBeenCalledWith([
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "shop",
        entity_id: "website-1",
        field: "seo_title_template",
        before_value: "{{product.title}}",
        after_value: "{{product.title}} | {{shop.name}}",
        source: "ui",
        model: null,
        user_id: "user-1",
      },
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "shop",
        entity_id: "website-1",
        field: "robots_index_products",
        before_value: "true",
        after_value: "false",
        source: "ui",
        model: null,
        user_id: "user-1",
      },
    ]);
  });

  it("returns the updated row when audit insertion fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const updated = shopMetaRow({ sitemap_enabled: false });
    const { supabase } = createSupabaseMock({
      existing: shopMetaRow({ sitemap_enabled: true }),
      updated,
      auditError: { message: "audit down" },
    });

    await expect(
      upsertShoplineShopMeta(
        supabase,
        "website-1",
        { sitemap_enabled: false },
        { userId: null, source: "ai" },
      ),
    ).resolves.toEqual(updated);
    expect(warnSpy).toHaveBeenCalledWith(
      "[shopline-shop-meta-service] audit log insert failed:",
      "audit down",
    );
    warnSpy.mockRestore();
  });
});
