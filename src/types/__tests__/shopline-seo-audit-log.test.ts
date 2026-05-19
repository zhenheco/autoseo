import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database } from "../database.types";

type AuditLogTable = Database["public"]["Tables"]["shopline_seo_audit_log"];
type RedirectsTable = Database["public"]["Tables"]["shopline_redirects"];

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
