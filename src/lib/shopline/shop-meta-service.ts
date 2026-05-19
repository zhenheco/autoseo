import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";

export type ShoplineShopMetaRow =
  Database["public"]["Tables"]["shopline_shop_meta"]["Row"];

type ShoplineShopMetaInsert =
  Database["public"]["Tables"]["shopline_shop_meta"]["Insert"];

type AuditInsert =
  Database["public"]["Tables"]["shopline_seo_audit_log"]["Insert"];

type ShoplineShopMetaPatch = {
  seo_title_template?: string | null;
  default_description?: string | null;
  robots_index_products?: boolean;
  robots_index_collections?: boolean;
  sitemap_enabled?: boolean;
  default_og_image?: string | null;
  hreflang_map?: Record<string, string> | null;
};

type AuditOptions = {
  userId?: string | null;
  source: "ui" | "cli" | "ai";
};

const SERVICE_LOG_PREFIX = "[shopline-shop-meta-service]";

export async function getShoplineShopMeta(
  supabase: SupabaseClient<Database>,
  websiteId: string,
): Promise<ShoplineShopMetaRow | null> {
  const { data, error } = await supabase
    .from("shopline_shop_meta")
    .select("*")
    .eq("website_id", websiteId)
    .maybeSingle();

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} select failed:`, error.message);
    return null;
  }

  return data as ShoplineShopMetaRow | null;
}

export async function upsertShoplineShopMeta(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  patch: ShoplineShopMetaPatch,
  auditOptions?: AuditOptions,
): Promise<ShoplineShopMetaRow> {
  const before = await getShoplineShopMeta(supabase, websiteId);
  const row: ShoplineShopMetaInsert = {
    website_id: websiteId,
    ...patch,
    hreflang_map: patch.hreflang_map as Json | null | undefined,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("shopline_shop_meta")
    .upsert(row, { onConflict: "website_id" })
    .select("*")
    .single();

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} upsert failed:`, error.message);
    throw error;
  }

  if (auditOptions) {
    const auditRows = await buildAuditRows(
      supabase,
      websiteId,
      before,
      patch,
      auditOptions,
    );
    await insertAuditRows(supabase, auditRows);
  }

  return data as ShoplineShopMetaRow;
}

async function buildAuditRows(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  before: ShoplineShopMetaRow | null,
  patch: ShoplineShopMetaPatch,
  auditOptions: AuditOptions,
): Promise<AuditInsert[]> {
  const companyId = await getWebsiteCompanyId(supabase, websiteId);

  return (
    Object.entries(patch) as Array<
      [
        keyof ShoplineShopMetaPatch,
        ShoplineShopMetaPatch[keyof ShoplineShopMetaPatch],
      ]
    >
  ).flatMap(([field, afterValue]) => {
    const beforeValue = before?.[field as keyof ShoplineShopMetaRow] as
      | Json
      | undefined;
    const beforeAuditValue = auditValue(beforeValue);
    const afterAuditValue = auditValue(afterValue as Json | undefined);

    if (beforeAuditValue === afterAuditValue) return [];

    return [
      {
        company_id: companyId,
        website_id: websiteId,
        entity_type: "shop",
        entity_id: websiteId,
        field,
        before_value: beforeAuditValue,
        after_value: afterAuditValue,
        source: auditOptions.source,
        model: null,
        user_id: auditOptions.userId ?? null,
      },
    ];
  });
}

async function getWebsiteCompanyId(
  supabase: SupabaseClient<Database>,
  websiteId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("website_configs")
    .select("company_id")
    .eq("id", websiteId)
    .maybeSingle();

  if (error || !data?.company_id) {
    console.warn(
      `${SERVICE_LOG_PREFIX} website company lookup failed:`,
      error?.message ?? "not_found",
    );
    return "";
  }

  return data.company_id;
}

function auditValue(value: Json | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

async function insertAuditRows(
  supabase: SupabaseClient<Database>,
  rows: AuditInsert[],
): Promise<void> {
  if (rows.length === 0) return;

  const { error } = await supabase.from("shopline_seo_audit_log").insert(rows);
  if (error) {
    console.warn(
      `${SERVICE_LOG_PREFIX} audit log insert failed:`,
      error.message,
    );
  }
}
