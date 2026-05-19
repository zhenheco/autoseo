import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { Database } from "../database.types";

type AuditLogTable = Database["public"]["Tables"]["shopline_seo_audit_log"];

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
