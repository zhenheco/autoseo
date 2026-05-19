import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database } from "../database.types";

type AuditLogTable = Database["public"]["Tables"]["shopline_seo_audit_log"];
type RedirectsTable = Database["public"]["Tables"]["shopline_redirects"];
type ShopMetaTable = Database["public"]["Tables"]["shopline_shop_meta"];

describe("shopline_seo_audit_log schema", () => {
  it("has generated Database types for rows and inserts", () => {
    expectTypeOf<AuditLogTable["Row"]>().toMatchTypeOf<{
      id: string;
      company_id: string;
      website_id: string;
      entity_type:
        | "product"
        | "collection"
        | "shop"
        | "image"
        | "category_assignment"
        | "redirect"
        | "collection_hierarchy";
      entity_id: string;
      field: string;
      before_value: string | null;
      after_value: string | null;
      source: "ui" | "cli" | "ai";
      model: string | null;
      user_id: string | null;
      created_at: string;
    }>();

    expectTypeOf<AuditLogTable["Insert"]>().toMatchTypeOf<{
      company_id: string;
      website_id: string;
      entity_type:
        | "product"
        | "collection"
        | "shop"
        | "image"
        | "category_assignment"
        | "redirect"
        | "collection_hierarchy";
      entity_id: string;
      field: string;
      source: "ui" | "cli" | "ai";
      id?: string;
      before_value?: string | null;
      after_value?: string | null;
      model?: string | null;
      user_id?: string | null;
      created_at?: string;
    }>();
  });

  it("creates the audit log table, indexes, and RLS policies", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFile = readdirSync(migrationsDir).find((file) =>
      file.endsWith("_shopline_seo_audit_log.sql"),
    );

    expect(migrationFile).toBeDefined();

    const sql = readFileSync(join(migrationsDir, migrationFile!), "utf8");

    expect(sql).toContain("CREATE TABLE public.shopline_seo_audit_log");
    expect(sql).toContain(
      "CHECK (entity_type IN ('product','collection','shop','image','category_assignment','redirect','collection_hierarchy'))",
    );
    expect(sql).toContain("CHECK (source IN ('ui','cli','ai'))");
    expect(sql).toContain(
      "CREATE INDEX shopline_seo_audit_log_company_website_idx",
    );
    expect(sql).toContain("CREATE INDEX shopline_seo_audit_log_entity_idx");
    expect(sql).toContain(
      "ALTER TABLE public.shopline_seo_audit_log ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain(
      "CREATE POLICY shopline_seo_audit_log_company_select",
    );
    expect(sql).toContain(
      "CREATE POLICY shopline_seo_audit_log_company_insert",
    );
    expect(sql).toContain("CREATE POLICY shopline_seo_audit_log_admin_select");
    expect(sql).toContain("public.company_members");
    expect(sql).toContain("profiles.role = 'admin'");
  });
});

describe("shopline_redirects schema", () => {
  it("has Database types for redirect rows, inserts, and updates", () => {
    expectTypeOf<RedirectsTable["Row"]>().toMatchTypeOf<{
      id: string;
      website_id: string;
      entity_type: "product" | "collection" | "page";
      entity_id: string | null;
      handle_from: string;
      handle_to: string;
      created_at: string;
      last_hit_at: string | null;
      hit_count: number;
    }>();

    expectTypeOf<RedirectsTable["Insert"]>().toMatchTypeOf<{
      website_id: string;
      entity_type: "product" | "collection" | "page";
      handle_from: string;
      handle_to: string;
      id?: string;
      entity_id?: string | null;
      created_at?: string;
      last_hit_at?: string | null;
      hit_count?: number;
    }>();

    expectTypeOf<RedirectsTable["Update"]>().toMatchTypeOf<{
      id?: string;
      website_id?: string;
      entity_type?: "product" | "collection" | "page";
      entity_id?: string | null;
      handle_from?: string;
      handle_to?: string;
      created_at?: string;
      last_hit_at?: string | null;
      hit_count?: number;
    }>();
  });

  it("creates the redirects table, unique key, index, and company RLS policies", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFile = readdirSync(migrationsDir).find((file) =>
      file.endsWith("_shopline_redirects.sql"),
    );

    expect(migrationFile).toBeDefined();

    const sql = readFileSync(join(migrationsDir, migrationFile!), "utf8");

    expect(sql).toContain("CREATE TABLE public.shopline_redirects");
    expect(sql).toContain(
      "CHECK (entity_type IN ('product','collection','page'))",
    );
    expect(sql).toContain("UNIQUE (website_id, entity_type, handle_from)");
    expect(sql).toContain("CREATE INDEX shopline_redirects_website_idx");
    expect(sql).toContain(
      "ALTER TABLE public.shopline_redirects ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain("CREATE POLICY shopline_redirects_company_select");
    expect(sql).toContain("CREATE POLICY shopline_redirects_company_insert");
    expect(sql).toContain("CREATE POLICY shopline_redirects_company_delete");
    expect(sql).toContain("JOIN public.website_configs wc");
    expect(sql).toContain("cm.status = 'active'");
  });
});

describe("shopline_shop_meta schema", () => {
  it("has Database types for shop meta rows, inserts, and updates", () => {
    expectTypeOf<ShopMetaTable["Row"]>().toMatchTypeOf<{
      id: string;
      website_id: string;
      seo_title_template: string | null;
      default_description: string | null;
      robots_index_products: boolean;
      robots_index_collections: boolean;
      sitemap_enabled: boolean;
      default_og_image: string | null;
      hreflang_map: Database["public"]["Tables"]["shopline_shop_meta"]["Row"]["hreflang_map"];
      updated_at: string;
    }>();

    expectTypeOf<ShopMetaTable["Insert"]>().toMatchTypeOf<{
      website_id: string;
      id?: string;
      seo_title_template?: string | null;
      default_description?: string | null;
      robots_index_products?: boolean;
      robots_index_collections?: boolean;
      sitemap_enabled?: boolean;
      default_og_image?: string | null;
      hreflang_map?: Database["public"]["Tables"]["shopline_shop_meta"]["Insert"]["hreflang_map"];
      updated_at?: string;
    }>();

    expectTypeOf<ShopMetaTable["Update"]>().toMatchTypeOf<{
      id?: string;
      website_id?: string;
      seo_title_template?: string | null;
      default_description?: string | null;
      robots_index_products?: boolean;
      robots_index_collections?: boolean;
      sitemap_enabled?: boolean;
      default_og_image?: string | null;
      hreflang_map?: Database["public"]["Tables"]["shopline_shop_meta"]["Update"]["hreflang_map"];
      updated_at?: string;
    }>();
  });

  it("creates the shop meta table, indexes, and company RLS policies", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFile = readdirSync(migrationsDir).find((file) =>
      file.endsWith("_shopline_shop_meta.sql"),
    );

    expect(migrationFile).toBeDefined();

    const sql = readFileSync(join(migrationsDir, migrationFile!), "utf8");

    expect(sql).toContain("CREATE TABLE public.shopline_shop_meta");
    expect(sql).toContain(
      "website_id UUID NOT NULL UNIQUE REFERENCES public.website_configs(id) ON DELETE CASCADE",
    );
    expect(sql).toContain(
      "robots_index_products BOOLEAN NOT NULL DEFAULT TRUE",
    );
    expect(sql).toContain(
      "robots_index_collections BOOLEAN NOT NULL DEFAULT TRUE",
    );
    expect(sql).toContain("sitemap_enabled BOOLEAN NOT NULL DEFAULT TRUE");
    expect(sql).toContain("hreflang_map JSONB");
    expect(sql).toContain("CREATE INDEX shopline_shop_meta_website_idx");
    expect(sql).toContain(
      "ALTER TABLE public.shopline_shop_meta ENABLE ROW LEVEL SECURITY",
    );
    expect(sql).toContain("CREATE POLICY shopline_shop_meta_company_select");
    expect(sql).toContain("CREATE POLICY shopline_shop_meta_company_insert");
    expect(sql).toContain("CREATE POLICY shopline_shop_meta_company_update");
    expect(sql).toContain("JOIN public.website_configs wc");
    expect(sql).toContain("cm.status = 'active'");
  });
});
