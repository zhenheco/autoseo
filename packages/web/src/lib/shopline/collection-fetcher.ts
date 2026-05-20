import { ShoplineClient } from "./client";
import {
  resolveShoplineAccessToken,
  type ShoplineConnectionStore,
} from "./connections";
import type { ShoplineCollection } from "./types";

export interface FetchShoplineCollectionsDependencies {
  store: ShoplineConnectionStore;
}

export interface FetchShoplineCollectionsResult {
  collections: ShoplineCollection[];
  nextCursor: string | null;
}

export async function fetchShoplineCollections(
  companyId: string,
  websiteId: string,
  cursor: string | null,
  options: FetchShoplineCollectionsDependencies,
): Promise<FetchShoplineCollectionsResult> {
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

  const result = await client.listCollections(
    cursor ? { pageInfo: cursor, limit: 50 } : { limit: 50 },
  );

  return {
    collections: result.collections,
    nextCursor: result.next?.pageInfo ?? null,
  };
}
