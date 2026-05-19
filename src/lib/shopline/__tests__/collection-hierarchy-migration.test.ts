import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Tables } from "@/types/database.types";

describe("shopline_collection_hierarchy migration", () => {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/20260520010000_shopline_collection_hierarchy.sql",
  );

  it("creates the hierarchy table with RLS policies matching website ownership", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("CREATE TABLE public.shopline_collection_hierarchy");
    expect(sql).toContain("UNIQUE (website_id, collection_id)");
    expect(sql).toContain("CHECK (collection_id <> parent_collection_id)");
    expect(sql).toContain(
      "ALTER TABLE public.shopline_collection_hierarchy ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain(
      "CREATE POLICY shopline_collection_hierarchy_company_select",
    );
    expect(sql).toContain(
      "CREATE POLICY shopline_collection_hierarchy_company_insert",
    );
    expect(sql).toContain(
      "CREATE POLICY shopline_collection_hierarchy_company_update",
    );
    expect(sql).toContain(
      "CREATE POLICY shopline_collection_hierarchy_company_delete",
    );
    expect(sql).toContain("JOIN public.website_configs wc");
    expect(sql).toContain("cm.user_id = auth.uid()");
  });

  it("exposes shopline_collection_hierarchy in generated database types", () => {
    const row = {} as Tables<"shopline_collection_hierarchy">;

    expectTypeOf(row.collection_id).toEqualTypeOf<string>();
    expectTypeOf(row.parent_collection_id).toEqualTypeOf<string | null>();
    expectTypeOf(row.display_order).toEqualTypeOf<number>();
  });
});
