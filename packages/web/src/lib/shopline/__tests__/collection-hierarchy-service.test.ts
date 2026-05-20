import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCollectionHierarchy,
  reparentCollection,
  reorderCollections,
} from "../collection-hierarchy-service";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type HierarchyRow = {
  collection_id: string;
  parent_collection_id: string | null;
  display_order: number;
};

function createSupabaseMock(options?: {
  hierarchyRows?: HierarchyRow[];
  currentRows?: HierarchyRow[];
  companyId?: string;
  upsertError?: { message: string } | null;
  auditError?: { message: string } | null;
}) {
  const state = {
    hierarchyRows: options?.hierarchyRows ?? [],
    currentRows: options?.currentRows ?? [],
    companyId: options?.companyId ?? "company-1",
    upsertError: options?.upsertError ?? null,
    auditError: options?.auditError ?? null,
  };
  const calls = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    upsert: vi.fn(),
    insert: vi.fn(),
  };

  const supabase = {
    from(table: string) {
      calls.from(table);

      if (table === "shopline_collection_hierarchy") {
        const builder = {
          select(columns: string) {
            calls.select(columns);
            return builder;
          },
          eq(column: string, value: unknown) {
            calls.eq(column, value);
            return builder;
          },
          in(column: string, value: unknown) {
            calls.in(column, value);
            return builder;
          },
          order(column: string, optionsArg?: unknown) {
            calls.order(column, optionsArg);
            return Promise.resolve({
              data: state.hierarchyRows,
              error: null,
            });
          },
          maybeSingle() {
            calls.maybeSingle();
            return Promise.resolve({
              data: state.currentRows[0] ?? null,
              error: null,
            });
          },
          then(resolve: (value: unknown) => void) {
            resolve({
              data: state.currentRows,
              error: null,
            });
          },
        };

        return {
          ...builder,
          upsert(rows: unknown, optionsArg?: unknown) {
            calls.upsert(rows, optionsArg);
            return Promise.resolve({ error: state.upsertError });
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

describe("collection-hierarchy-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns hierarchy rows ordered by display_order", async () => {
    const { supabase, calls } = createSupabaseMock({
      hierarchyRows: [
        {
          collection_id: "child",
          parent_collection_id: "parent",
          display_order: 2,
        },
      ],
    });

    await expect(
      getCollectionHierarchy(supabase, "website-1"),
    ).resolves.toEqual([
      {
        collection_id: "child",
        parent_collection_id: "parent",
        display_order: 2,
      },
    ]);
    expect(calls.from).toHaveBeenCalledWith("shopline_collection_hierarchy");
    expect(calls.eq).toHaveBeenCalledWith("website_id", "website-1");
    expect(calls.order).toHaveBeenCalledWith("display_order", {
      ascending: true,
    });
  });

  it("reparents a collection by upserting hierarchy and auditing parent_id", async () => {
    const { supabase, calls } = createSupabaseMock({
      currentRows: [
        {
          collection_id: "child",
          parent_collection_id: null,
          display_order: 0,
        },
      ],
    });

    await reparentCollection(
      supabase,
      {
        websiteId: "website-1",
        collectionId: "child",
        parentCollectionId: "parent",
        displayOrder: 5,
      },
      { userId: "user-1", source: "ui" },
    );

    expect(calls.upsert).toHaveBeenCalledWith(
      {
        website_id: "website-1",
        collection_id: "child",
        parent_collection_id: "parent",
        display_order: 5,
        updated_at: expect.any(String),
      },
      { onConflict: "website_id,collection_id" },
    );
    expect(calls.insert).toHaveBeenCalledWith([
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "collection_hierarchy",
        entity_id: "child",
        field: "parent_id",
        before_value: null,
        after_value: "parent",
        source: "ui",
        model: null,
        user_id: "user-1",
      },
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "collection_hierarchy",
        entity_id: "child",
        field: "display_order",
        before_value: "0",
        after_value: "5",
        source: "ui",
        model: null,
        user_id: "user-1",
      },
    ]);
  });

  it("rejects direct self-parenting before hitting Supabase", async () => {
    const { supabase, calls } = createSupabaseMock();

    await expect(
      reparentCollection(supabase, {
        websiteId: "website-1",
        collectionId: "child",
        parentCollectionId: "child",
      }),
    ).rejects.toThrow("shopline_collection_hierarchy_cycle");
    expect(calls.from).not.toHaveBeenCalled();
  });

  it("reorders collections with batch upsert and display_order audit rows", async () => {
    const { supabase, calls } = createSupabaseMock({
      currentRows: [
        {
          collection_id: "a",
          parent_collection_id: null,
          display_order: 9,
        },
        {
          collection_id: "b",
          parent_collection_id: null,
          display_order: 8,
        },
      ],
    });

    await reorderCollections(
      supabase,
      "website-1",
      [
        { collectionId: "a", displayOrder: 1 },
        { collectionId: "b", displayOrder: 2 },
      ],
      { source: "ai", userId: null },
    );

    expect(calls.upsert).toHaveBeenCalledWith(
      [
        {
          website_id: "website-1",
          collection_id: "a",
          display_order: 1,
          updated_at: expect.any(String),
        },
        {
          website_id: "website-1",
          collection_id: "b",
          display_order: 2,
          updated_at: expect.any(String),
        },
      ],
      { onConflict: "website_id,collection_id" },
    );
    expect(calls.insert).toHaveBeenCalledWith([
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "collection_hierarchy",
        entity_id: "a",
        field: "display_order",
        before_value: "9",
        after_value: "1",
        source: "ai",
        model: null,
        user_id: null,
      },
      {
        company_id: "company-1",
        website_id: "website-1",
        entity_type: "collection_hierarchy",
        entity_id: "b",
        field: "display_order",
        before_value: "8",
        after_value: "2",
        source: "ai",
        model: null,
        user_id: null,
      },
    ]);
  });

  it("warns without throwing when Supabase writes fail", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { supabase } = createSupabaseMock({
      upsertError: { message: "database unavailable" },
    });

    await expect(
      reparentCollection(supabase, {
        websiteId: "website-1",
        collectionId: "child",
        parentCollectionId: null,
      }),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[shopline-collection-hierarchy-service] upsert failed:",
      "database unavailable",
    );
    warnSpy.mockRestore();
  });
});
