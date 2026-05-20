import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CollectionHierarchySupabase {
  supabase: SupabaseClient<Database>;
}

type CollectionHierarchyRow = Pick<
  Database["public"]["Tables"]["shopline_collection_hierarchy"]["Row"],
  "collection_id" | "parent_collection_id" | "display_order"
>;

type AuditOptions = {
  userId?: string | null;
  source: "ui" | "cli" | "ai";
};

type AuditInsert =
  Database["public"]["Tables"]["shopline_seo_audit_log"]["Insert"];

const SERVICE_LOG_PREFIX = "[shopline-collection-hierarchy-service]";

export async function getCollectionHierarchy(
  supabase: SupabaseClient<Database>,
  websiteId: string,
): Promise<CollectionHierarchyRow[]> {
  const { data, error } = await supabase
    .from("shopline_collection_hierarchy")
    .select("collection_id,parent_collection_id,display_order")
    .eq("website_id", websiteId)
    .order("display_order", { ascending: true });

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} select failed:`, error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    collection_id: row.collection_id,
    parent_collection_id: row.parent_collection_id,
    display_order: row.display_order,
  }));
}

export async function reparentCollection(
  supabase: SupabaseClient<Database>,
  input: {
    websiteId: string;
    collectionId: string;
    parentCollectionId: string | null;
    displayOrder?: number;
  },
  auditOptions?: AuditOptions,
): Promise<void> {
  if (input.parentCollectionId === input.collectionId) {
    throw new Error("shopline_collection_hierarchy_cycle");
  }

  const before = auditOptions
    ? await getExistingHierarchyRow(
        supabase,
        input.websiteId,
        input.collectionId,
      )
    : null;
  const row = {
    website_id: input.websiteId,
    collection_id: input.collectionId,
    parent_collection_id: input.parentCollectionId,
    ...(typeof input.displayOrder === "number"
      ? { display_order: input.displayOrder }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("shopline_collection_hierarchy")
    .upsert(row, { onConflict: "website_id,collection_id" });

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} upsert failed:`, error.message);
    return;
  }

  if (auditOptions) {
    const rows: AuditInsert[] = [];

    if (before?.parent_collection_id !== input.parentCollectionId) {
      rows.push(
        buildAuditRow({
          companyId: await getWebsiteCompanyId(supabase, input.websiteId),
          websiteId: input.websiteId,
          collectionId: input.collectionId,
          field: "parent_id",
          beforeValue: before?.parent_collection_id ?? null,
          afterValue: input.parentCollectionId,
          auditOptions,
        }),
      );
    }

    if (
      typeof input.displayOrder === "number" &&
      before?.display_order !== input.displayOrder
    ) {
      rows.push(
        buildAuditRow({
          companyId: await getWebsiteCompanyId(supabase, input.websiteId),
          websiteId: input.websiteId,
          collectionId: input.collectionId,
          field: "display_order",
          beforeValue:
            typeof before?.display_order === "number"
              ? String(before.display_order)
              : null,
          afterValue: String(input.displayOrder),
          auditOptions,
        }),
      );
    }

    await insertAuditRows(supabase, rows);
  }
}

export async function reorderCollections(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  order: Array<{ collectionId: string; displayOrder: number }>,
  auditOptions?: AuditOptions,
): Promise<void> {
  if (order.length === 0) return;

  const collectionIds = order.map((item) => item.collectionId);
  const beforeRows = auditOptions
    ? await getExistingHierarchyRows(supabase, websiteId, collectionIds)
    : [];
  const now = new Date().toISOString();
  const rows = order.map((item) => ({
    website_id: websiteId,
    collection_id: item.collectionId,
    display_order: item.displayOrder,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("shopline_collection_hierarchy")
    .upsert(rows, { onConflict: "website_id,collection_id" });

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} upsert failed:`, error.message);
    return;
  }

  if (auditOptions) {
    const companyId = await getWebsiteCompanyId(supabase, websiteId);
    const beforeById = new Map(
      beforeRows.map((row) => [row.collection_id, row.display_order]),
    );
    const auditRows = order.flatMap((item) => {
      const beforeValue = beforeById.get(item.collectionId);
      if (beforeValue === item.displayOrder) return [];

      return [
        buildAuditRow({
          companyId,
          websiteId,
          collectionId: item.collectionId,
          field: "display_order",
          beforeValue:
            typeof beforeValue === "number" ? String(beforeValue) : null,
          afterValue: String(item.displayOrder),
          auditOptions,
        }),
      ];
    });

    await insertAuditRows(supabase, auditRows);
  }
}

async function getExistingHierarchyRow(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  collectionId: string,
): Promise<CollectionHierarchyRow | null> {
  const { data, error } = await supabase
    .from("shopline_collection_hierarchy")
    .select("collection_id,parent_collection_id,display_order")
    .eq("website_id", websiteId)
    .eq("collection_id", collectionId)
    .maybeSingle();

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} select failed:`, error.message);
    return null;
  }

  return data;
}

async function getExistingHierarchyRows(
  supabase: SupabaseClient<Database>,
  websiteId: string,
  collectionIds: string[],
): Promise<CollectionHierarchyRow[]> {
  const { data, error } = await supabase
    .from("shopline_collection_hierarchy")
    .select("collection_id,parent_collection_id,display_order")
    .eq("website_id", websiteId)
    .in("collection_id", collectionIds);

  if (error) {
    console.warn(`${SERVICE_LOG_PREFIX} select failed:`, error.message);
    return [];
  }

  return data ?? [];
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

function buildAuditRow(params: {
  companyId: string;
  websiteId: string;
  collectionId: string;
  field: "parent_id" | "display_order";
  beforeValue: string | null;
  afterValue: string | null;
  auditOptions: AuditOptions;
}): AuditInsert {
  return {
    company_id: params.companyId,
    website_id: params.websiteId,
    entity_type: "collection_hierarchy",
    entity_id: params.collectionId,
    field: params.field,
    before_value: params.beforeValue,
    after_value: params.afterValue,
    source: params.auditOptions.source,
    model: null,
    user_id: params.auditOptions.userId ?? null,
  };
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
