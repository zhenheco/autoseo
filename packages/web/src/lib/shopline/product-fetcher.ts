import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
import type { ShoplineProduct } from "./types";

export interface FetchShoplineProductsDependencies {
  store: ShoplineConnectionStore;
}

export interface FetchShoplineProductsResult {
  products: ShoplineProduct[];
  nextCursor?: string;
}

export async function fetchShoplineProducts(
  companyId: string,
  websiteId: string,
  cursor: string | undefined,
  deps: FetchShoplineProductsDependencies,
): Promise<FetchShoplineProductsResult> {
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

  const result = await client.listProducts(
    cursor ? { pageInfo: cursor, limit: 50 } : { limit: 50 },
  );

  return {
    products: result.products,
    nextCursor: result.next?.pageInfo,
  };
}
