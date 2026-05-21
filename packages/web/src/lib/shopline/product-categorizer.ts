import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
import type { Database } from "@/types/database.types";

type CategorizerAuditInsert =
  Database["public"]["Tables"]["shopline_seo_audit_log"]["Insert"];

type CategorizerAuditInsertResult = PromiseLike<{
  error: { message?: string } | null;
}>;

export interface CategorizerAuditOptions {
  supabase: {
    from: (table: "shopline_seo_audit_log") => {
      insert: (rows: CategorizerAuditInsert[]) => CategorizerAuditInsertResult;
    };
  };
  userId?: string | null;
  source: "ui" | "cli" | "ai";
}

export interface UpdateShoplineProductCategoriesResult {
  added: Array<{ collection_id: string; success: boolean; error?: string }>;
  removed: Array<{ collection_id: string; success: boolean; error?: string }>;
}

type AuditRow = CategorizerAuditInsert;

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "unknown_error";
}

function buildAuditRow(params: {
  companyId: string;
  websiteId: string;
  productId: string;
  collectionId: string;
  beforeValue: string | null;
  afterValue: string | null;
  auditOptions: CategorizerAuditOptions;
}): AuditRow {
  return {
    company_id: params.companyId,
    website_id: params.websiteId,
    entity_type: "category_assignment",
    entity_id: params.productId,
    field: "collection_id",
    before_value: params.beforeValue,
    after_value: params.afterValue,
    source: params.auditOptions.source,
    model: null,
    user_id: params.auditOptions.userId ?? null,
  };
}

export async function updateShoplineProductCategories(
  companyId: string,
  websiteId: string,
  productId: string,
  diff: { add: string[]; remove: string[] },
  options: {
    store: ShoplineConnectionStore;
    auditOptions?: CategorizerAuditOptions;
  },
): Promise<UpdateShoplineProductCategoriesResult> {
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
  const current = await client.listProductCollects(productId);
  const collectIdByCollectionId = new Map(
    current.collects.map((collect) => [collect.collection_id, collect.id]),
  );

  const added: UpdateShoplineProductCategoriesResult["added"] = [];
  const removed: UpdateShoplineProductCategoriesResult["removed"] = [];
  const auditRows: AuditRow[] = [];

  for (const collectionId of diff.add) {
    try {
      await client.assignProductToCollection(productId, collectionId);
      added.push({ collection_id: collectionId, success: true });
      if (options.auditOptions) {
        auditRows.push(
          buildAuditRow({
            companyId,
            websiteId,
            productId,
            collectionId,
            beforeValue: null,
            afterValue: collectionId,
            auditOptions: options.auditOptions,
          }),
        );
      }
    } catch (error) {
      added.push({
        collection_id: collectionId,
        success: false,
        error: errorMessage(error),
      });
    }
  }

  for (const collectionId of diff.remove) {
    const collectId = collectIdByCollectionId.get(collectionId);
    if (!collectId) {
      removed.push({
        collection_id: collectionId,
        success: false,
        error: "shopline_collect_not_found",
      });
      continue;
    }

    try {
      await client.removeProductFromCollection(collectId);
      removed.push({ collection_id: collectionId, success: true });
      if (options.auditOptions) {
        auditRows.push(
          buildAuditRow({
            companyId,
            websiteId,
            productId,
            collectionId,
            beforeValue: collectionId,
            afterValue: null,
            auditOptions: options.auditOptions,
          }),
        );
      }
    } catch (error) {
      removed.push({
        collection_id: collectionId,
        success: false,
        error: errorMessage(error),
      });
    }
  }

  if (options.auditOptions && auditRows.length > 0) {
    const { error } = await options.auditOptions.supabase
      .from("shopline_seo_audit_log")
      .insert(auditRows);
    if (error) {
      console.warn(
        "[shopline-product-categorizer] audit log insert failed:",
        error.message ?? "unknown",
      );
    }
  }

  return { added, removed };
}
