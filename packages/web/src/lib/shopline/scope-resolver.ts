import type { ShoplineConnectionStore } from "./connections";

export interface ShoplineScopeLookup {
  companyId: string;
  websiteId: string;
}

export async function getGrantedScopes(
  store: ShoplineConnectionStore,
  input: ShoplineScopeLookup,
): Promise<string[]> {
  const connection = await store.findConnection({
    companyId: input.companyId,
    websiteId: input.websiteId,
    status: "active",
  });

  if (!connection) {
    throw new Error("shopline_no_connection");
  }

  return connection.granted_scopes ?? [];
}
