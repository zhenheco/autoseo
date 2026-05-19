import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
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

  return client.updateProduct(productId, payload);
}
