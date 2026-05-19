import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
import type { ShoplineImage } from "./types";

export interface ImageAltAuditOptions {
  supabase: {
    from: (table: "shopline_seo_audit_log") => {
      insert: (
        rows: Record<string, unknown>[],
      ) => PromiseLike<{ error: { message?: string } | null }>;
    };
  };
  userId?: string | null;
  source: "ui" | "cli" | "ai";
  model?: string | null;
}

function auditValue(value: string | null | undefined): string | null {
  return value ?? null;
}

export async function updateShoplineImageAlt(
  companyId: string,
  websiteId: string,
  productId: string,
  imageId: string,
  alt: string,
  options: {
    store: ShoplineConnectionStore;
    auditOptions?: ImageAltAuditOptions;
    before?: { alt?: string | null };
  },
): Promise<ShoplineImage> {
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

  const updatedImage = await client.updateProductImage(productId, imageId, {
    alt,
  });

  if (
    options.auditOptions &&
    auditValue(options.before?.alt) !== auditValue(alt)
  ) {
    const { error } = await options.auditOptions.supabase
      .from("shopline_seo_audit_log")
      .insert([
        {
          company_id: companyId,
          website_id: websiteId,
          entity_type: "image",
          entity_id: imageId,
          field: "alt",
          before_value: auditValue(options.before?.alt),
          after_value: auditValue(alt),
          source: options.auditOptions.source,
          model: options.auditOptions.model ?? null,
          user_id: options.auditOptions.userId ?? null,
        },
      ]);

    if (error) {
      console.warn(
        "[shopline-image-alt-updater] audit log insert failed:",
        error.message ?? "unknown",
      );
    }
  }

  return updatedImage;
}
