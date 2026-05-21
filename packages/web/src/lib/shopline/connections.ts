export type ShoplineConnectionStatus = "active" | "error" | "revoked";

export interface StoredShoplineConnection {
  id: string;
  company_id: string;
  website_id: string;
  shop_handle: string;
  shop_domain: string;
  access_token_encrypted?: string;
  granted_scopes: string[];
  status: ShoplineConnectionStatus;
  last_verified_at: string | null;
  updated_at: string | null;
}

export interface ShoplineConnectionUpsert {
  company_id: string;
  website_id: string;
  shop_handle: string;
  shop_domain: string;
  access_token_encrypted: string;
  granted_scopes: string[];
  status: ShoplineConnectionStatus;
  last_verified_at: string;
  authorized_at: string;
  updated_at: string;
  created_by?: string | null;
}

export interface ShoplineConnectionFindFilter {
  companyId: string;
  websiteId?: string;
  shopHandle?: string;
  status?: ShoplineConnectionStatus;
}

export interface ShoplineConnectionStore {
  encryptToken(token: string): Promise<string>;
  decryptToken(ciphertext: string): Promise<string>;
  upsertConnection(
    row: ShoplineConnectionUpsert,
  ): Promise<StoredShoplineConnection>;
  findConnection(
    filter: ShoplineConnectionFindFilter,
  ): Promise<StoredShoplineConnection | null>;
}

export interface PersistShoplineConnectionInput {
  companyId: string;
  websiteId: string;
  shopHandle: string;
  accessToken: string;
  scope?: string;
  actorUserId?: string | null;
}

export interface ShoplineConnectionPublicStatus {
  connected: boolean;
  shopHandle?: string;
  shopDomain?: string;
  grantedScopes?: string[];
  status?: ShoplineConnectionStatus;
  lastVerifiedAt?: string | null;
  updatedAt?: string | null;
}

export interface ResolvedShoplineAccessToken {
  shopHandle: string;
  accessToken: string;
  grantedScopes: string[];
}

function normalizeShopHandle(shopHandle: string): string {
  const normalized = shopHandle.endsWith(".myshopline.com")
    ? shopHandle.slice(0, -".myshopline.com".length)
    : shopHandle;

  if (!/^[a-zA-Z0-9-]+$/.test(normalized)) {
    throw new Error("invalid_shopline_shop_handle");
  }

  return normalized;
}

function parseScopes(scope: string | undefined): string[] {
  if (!scope) return [];
  return scope
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toPublicStatus(
  connection: StoredShoplineConnection,
): ShoplineConnectionPublicStatus {
  return {
    connected: connection.status === "active",
    shopHandle: connection.shop_handle,
    shopDomain: connection.shop_domain,
    grantedScopes: connection.granted_scopes ?? [],
    status: connection.status,
    lastVerifiedAt: connection.last_verified_at,
    updatedAt: connection.updated_at,
  };
}

export async function persistShoplineConnection(
  store: ShoplineConnectionStore,
  input: PersistShoplineConnectionInput,
): Promise<ShoplineConnectionPublicStatus> {
  if (!input.companyId) throw new Error("company_id_required");
  if (!input.websiteId) throw new Error("website_id_required");
  if (!input.accessToken) throw new Error("shopline_access_token_required");

  const shopHandle = normalizeShopHandle(input.shopHandle);
  const now = new Date().toISOString();
  const encrypted = await store.encryptToken(input.accessToken);
  const connection = await store.upsertConnection({
    company_id: input.companyId,
    website_id: input.websiteId,
    shop_handle: shopHandle,
    shop_domain: `${shopHandle}.myshopline.com`,
    access_token_encrypted: encrypted,
    granted_scopes: parseScopes(input.scope),
    status: "active",
    last_verified_at: now,
    authorized_at: now,
    updated_at: now,
    created_by: input.actorUserId ?? null,
  });

  return toPublicStatus(connection);
}

export async function getShoplineConnectionStatus(
  store: ShoplineConnectionStore,
  filter: ShoplineConnectionFindFilter,
): Promise<ShoplineConnectionPublicStatus> {
  const connection = await store.findConnection(filter);
  if (!connection) return { connected: false };
  return toPublicStatus(connection);
}

export async function resolveShoplineAccessToken(
  store: ShoplineConnectionStore,
  filter: ShoplineConnectionFindFilter,
): Promise<ResolvedShoplineAccessToken> {
  const connection = await store.findConnection({
    ...filter,
    status: "active",
  });
  if (!connection?.access_token_encrypted) {
    throw new Error("shopline_connection_not_found");
  }

  const accessToken = await store.decryptToken(
    connection.access_token_encrypted,
  );
  if (!accessToken) throw new Error("shopline_connection_token_missing");

  return {
    shopHandle: connection.shop_handle,
    accessToken,
    grantedScopes: connection.granted_scopes ?? [],
  };
}

type SupabaseClientLike = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => unknown;
};

type QueryLike = {
  select: (columns?: string) => QueryLike;
  upsert: (row: unknown, options?: unknown) => QueryLike;
  eq: (column: string, value: unknown) => QueryLike;
  single: () => Promise<{ data: unknown; error: { message: string } | null }>;
  maybeSingle: () => Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

const CONNECTION_SELECT =
  "id, company_id, website_id, shop_handle, shop_domain, access_token_encrypted, granted_scopes, status, last_verified_at, updated_at";

export function createSupabaseShoplineConnectionStore(
  client: SupabaseClientLike,
): ShoplineConnectionStore {
  return {
    async encryptToken(token: string): Promise<string> {
      const { data, error } = await client.rpc("encrypt_data", {
        plaintext: token,
        key_name: "api_keys",
      });
      if (error)
        throw new Error(`shopline_token_encrypt_failed: ${error.message}`);
      if (typeof data !== "string" || !data)
        throw new Error("shopline_token_encrypt_failed");
      return data;
    },

    async decryptToken(ciphertext: string): Promise<string> {
      const { data, error } = await client.rpc("decrypt_data", {
        ciphertext,
        key_name: "api_keys",
      });
      if (error)
        throw new Error(`shopline_token_decrypt_failed: ${error.message}`);
      if (typeof data !== "string")
        throw new Error("shopline_token_decrypt_failed");
      return data;
    },

    async upsertConnection(
      row: ShoplineConnectionUpsert,
    ): Promise<StoredShoplineConnection> {
      const query = client.from("shopline_connections") as QueryLike;
      const { data, error } = await query
        .upsert(row, { onConflict: "company_id,website_id" })
        .select(CONNECTION_SELECT)
        .single();
      if (error)
        throw new Error(`shopline_connection_upsert_failed: ${error.message}`);
      return data as StoredShoplineConnection;
    },

    async findConnection(
      filter: ShoplineConnectionFindFilter,
    ): Promise<StoredShoplineConnection | null> {
      if (!filter.websiteId && !filter.shopHandle) {
        throw new Error("shopline_connection_filter_required");
      }

      let query = (client.from("shopline_connections") as QueryLike)
        .select(CONNECTION_SELECT)
        .eq("company_id", filter.companyId);

      if (filter.websiteId) query = query.eq("website_id", filter.websiteId);
      if (filter.shopHandle)
        query = query.eq("shop_handle", normalizeShopHandle(filter.shopHandle));
      if (filter.status) query = query.eq("status", filter.status);

      const { data, error } = await query.maybeSingle();
      if (error)
        throw new Error(`shopline_connection_lookup_failed: ${error.message}`);
      return (data as StoredShoplineConnection | null) ?? null;
    },
  };
}
