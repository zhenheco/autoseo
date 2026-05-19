import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
import {
  createShoplineRedirect,
  type RedirectStoreSupabase,
} from "./redirect-store";
import type { Database } from "@/types/database.types";
import type { ShoplineCollection } from "./types";

export type ShoplineCollectionSeoUpdateSource = "ui" | "cli" | "ai";

export interface ShoplineCollectionSeoPatch {
  seo?: {
    title?: string;
    description?: string;
  };
  handle?: string;
  title?: string;
}

export interface UpdateShoplineCollectionSeoDependencies {
  store: ShoplineConnectionStore;
  auditOptions?: ShoplineCollectionSeoAuditOptions;
  before?: {
    title?: string;
    handle?: string;
    seo?: {
      title?: string;
      description?: string;
    };
  };
}

type ShoplineSeoAuditInsert =
  Database["public"]["Tables"]["shopline_seo_audit_log"]["Insert"];

type ShoplineSeoAuditInsertResult = PromiseLike<{
  error: { message?: string } | null;
}>;

export interface ShoplineCollectionSeoAuditOptions {
  supabase: {
    from: ((table: "shopline_seo_audit_log") => {
      insert: (rows: ShoplineSeoAuditInsert[]) => ShoplineSeoAuditInsertResult;
    }) &
      RedirectStoreSupabase["from"];
  };
  userId?: string | null;
  source: ShoplineCollectionSeoUpdateSource;
  model?: string | null;
}

type ShoplineCollectionUpdatePayload = {
  seo?: {
    title?: string;
    description?: string;
  };
  handle?: string;
  title?: string;
};

function buildCollectionUpdatePayload(
  patch: ShoplineCollectionSeoPatch,
): ShoplineCollectionUpdatePayload {
  const payload: ShoplineCollectionUpdatePayload = {};

  if (patch.seo) {
    const seo: NonNullable<ShoplineCollectionUpdatePayload["seo"]> = {};
    if (typeof patch.seo.title === "string") seo.title = patch.seo.title;
    if (typeof patch.seo.description === "string") {
      seo.description = patch.seo.description;
    }
    if (Object.keys(seo).length > 0) payload.seo = seo;
  }

  if (typeof patch.handle === "string") payload.handle = patch.handle;
  if (typeof patch.title === "string") payload.title = patch.title;

  if (Object.keys(payload).length === 0) {
    throw new Error("shopline_update_collection_no_fields");
  }

  return payload;
}

function auditValue(value: string | null | undefined): string | null {
  return value ?? null;
}

function buildCollectionAuditRows(params: {
  companyId: string;
  websiteId: string;
  collectionId: string;
  patch: ShoplineCollectionSeoPatch;
  before: UpdateShoplineCollectionSeoDependencies["before"];
  after: ShoplineCollection;
  auditOptions: ShoplineCollectionSeoAuditOptions;
}): ShoplineSeoAuditInsert[] {
  const rows: ShoplineSeoAuditInsert[] = [];
  const base = {
    company_id: params.companyId,
    website_id: params.websiteId,
    entity_type: "collection" as const,
    entity_id: params.collectionId,
    source: params.auditOptions.source,
    model: params.auditOptions.model ?? null,
    user_id: params.auditOptions.userId ?? null,
  };

  const pushIfChanged = (
    field: "seo.title" | "seo.description" | "handle" | "title",
    beforeValue: string | null | undefined,
    afterValue: string | null | undefined,
  ) => {
    const before = auditValue(beforeValue);
    const after = auditValue(afterValue);
    if (before === after) return;

    rows.push({
      ...base,
      field,
      before_value: before,
      after_value: after,
    });
  };

  if (typeof params.patch.seo?.title === "string") {
    pushIfChanged(
      "seo.title",
      params.before?.seo?.title,
      params.after.seo?.title,
    );
  }

  if (typeof params.patch.seo?.description === "string") {
    pushIfChanged(
      "seo.description",
      params.before?.seo?.description,
      params.after.seo?.description,
    );
  }

  if (typeof params.patch.handle === "string") {
    pushIfChanged("handle", params.before?.handle, params.after.handle);
  }

  if (typeof params.patch.title === "string") {
    pushIfChanged("title", params.before?.title, params.after.title);
  }

  return rows;
}

export async function updateShoplineCollectionSeo(
  companyId: string,
  websiteId: string,
  collectionId: string,
  patch: ShoplineCollectionSeoPatch,
  options: UpdateShoplineCollectionSeoDependencies,
): Promise<ShoplineCollection> {
  const payload = buildCollectionUpdatePayload(patch);

  let auth;
  try {
    auth = await resolveShoplineAccessToken(options.store, {
      companyId,
      websiteId,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "shopline_connection_not_found" ||
        error.message === "shopline_connection_token_missing")
    ) {
      throw new Error("shopline_no_connection");
    }
    throw error;
  }

  const client = new ShoplineClient({
    shopHandle: auth.shopHandle,
    accessToken: auth.accessToken,
  });

  const beforeCollection = options.auditOptions
    ? (options.before ?? (await client.getCollection(collectionId)))
    : null;
  const updatedCollection = await client.updateCollection(
    collectionId,
    payload,
  );

  if (
    options.auditOptions &&
    beforeCollection?.handle &&
    typeof patch.handle === "string" &&
    patch.handle !== beforeCollection.handle
  ) {
    try {
      await createShoplineRedirect(options.auditOptions.supabase, {
        websiteId,
        entityType: "collection",
        entityId: collectionId,
        handleFrom: beforeCollection.handle,
        handleTo: patch.handle,
      });
    } catch (error) {
      console.warn(
        "[shopline-collection-seo-updater] redirect create failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }

  if (options.auditOptions && beforeCollection) {
    const auditRows = buildCollectionAuditRows({
      companyId,
      websiteId,
      collectionId,
      patch,
      before: beforeCollection,
      after: updatedCollection,
      auditOptions: options.auditOptions,
    });

    if (auditRows.length > 0) {
      const { error } = await options.auditOptions.supabase
        .from("shopline_seo_audit_log")
        .insert(auditRows);
      if (error) {
        console.warn(
          "[shopline-collection-seo-updater] audit log insert failed:",
          error.message ?? "unknown",
        );
        return updatedCollection;
      }
    }
  }

  return updatedCollection;
}
