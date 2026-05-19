import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
import type { Database } from "@/types/database.types";
import type { ShoplineProduct } from "./types";

export type ShoplineSeoUpdateSource = "ui" | "cli" | "ai";

export interface ShoplineProductSeoPatch {
  seo?: {
    title?: string;
    description?: string;
  };
  handle?: string;
  title?: string;
  source?: ShoplineSeoUpdateSource;
}

export interface UpdateShoplineProductSeoDependencies {
  store: ShoplineConnectionStore;
  auditOptions?: ShoplineSeoAuditOptions;
}

type ShoplineSeoAuditInsert =
  Database["public"]["Tables"]["shopline_seo_audit_log"]["Insert"];

type ShoplineSeoAuditInsertResult = PromiseLike<{
  error: { message?: string } | null;
}>;

export interface ShoplineSeoAuditOptions {
  supabase: {
    from: (table: "shopline_seo_audit_log") => {
      insert: (rows: ShoplineSeoAuditInsert[]) => ShoplineSeoAuditInsertResult;
    };
  };
  userId?: string | null;
  source: ShoplineSeoUpdateSource;
  model?: string | null;
}

type ShoplineProductUpdatePayload = {
  seo?: {
    title?: string;
    description?: string;
  };
  handle?: string;
  title?: string;
};

function buildProductUpdatePayload(
  patch: ShoplineProductSeoPatch,
): ShoplineProductUpdatePayload {
  const payload: ShoplineProductUpdatePayload = {};

  if (patch.seo) {
    const seo: NonNullable<ShoplineProductUpdatePayload["seo"]> = {};
    if (typeof patch.seo.title === "string") seo.title = patch.seo.title;
    if (typeof patch.seo.description === "string") {
      seo.description = patch.seo.description;
    }
    if (Object.keys(seo).length > 0) payload.seo = seo;
  }

  if (typeof patch.handle === "string") payload.handle = patch.handle;
  if (typeof patch.title === "string") payload.title = patch.title;

  if (Object.keys(payload).length === 0) {
    throw new Error("shopline_update_product_no_fields");
  }

  return payload;
}

function auditValue(value: string | null | undefined): string | null {
  return value ?? null;
}

function buildProductAuditRows(params: {
  companyId: string;
  websiteId: string;
  productId: string;
  patch: ShoplineProductSeoPatch;
  before: ShoplineProduct;
  after: ShoplineProduct;
  auditOptions: ShoplineSeoAuditOptions;
}): ShoplineSeoAuditInsert[] {
  const rows: ShoplineSeoAuditInsert[] = [];
  const base = {
    company_id: params.companyId,
    website_id: params.websiteId,
    entity_type: "product" as const,
    entity_id: params.productId,
    source: params.auditOptions.source,
    model: params.auditOptions.model ?? null,
    user_id: params.auditOptions.userId ?? null,
  };

  const pushIfChanged = (
    field: "seo.title" | "seo.description" | "handle",
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
      params.before.seo?.title,
      params.after.seo?.title,
    );
  }

  if (typeof params.patch.seo?.description === "string") {
    pushIfChanged(
      "seo.description",
      params.before.seo?.description,
      params.after.seo?.description,
    );
  }

  if (typeof params.patch.handle === "string") {
    pushIfChanged("handle", params.before.handle, params.after.handle);
  }

  return rows;
}

export async function updateShoplineProductSeo(
  companyId: string,
  websiteId: string,
  productId: string,
  patch: ShoplineProductSeoPatch,
  deps: UpdateShoplineProductSeoDependencies,
): Promise<ShoplineProduct> {
  const payload = buildProductUpdatePayload(patch);

  let auth;
  try {
    auth = await resolveShoplineAccessToken(deps.store, {
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

  const beforeProduct = deps.auditOptions
    ? await client.getProduct(productId)
    : null;
  const updatedProduct = await client.updateProduct(productId, payload);

  if (deps.auditOptions && beforeProduct) {
    const auditRows = buildProductAuditRows({
      companyId,
      websiteId,
      productId,
      patch,
      before: beforeProduct,
      after: updatedProduct,
      auditOptions: deps.auditOptions,
    });

    if (auditRows.length > 0) {
      const { error } = await deps.auditOptions.supabase
        .from("shopline_seo_audit_log")
        .insert(auditRows);
      if (error) {
        throw new Error(
          `shopline_seo_audit_log_insert_failed: ${error.message ?? "unknown"}`,
        );
      }
    }
  }

  return updatedProduct;
}
