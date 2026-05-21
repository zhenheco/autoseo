import { createAdminClient } from "@shared/supabase";
import {
  createSupabaseShoplineConnectionStore,
  resolveShoplineAccessToken,
} from "./connections";

export type ShoplineCliArgs = Record<string, string | boolean>;

export interface ShoplineCliAuthStore {
  resolveConnectionToken(input: {
    companyId: string;
    websiteId?: string;
    shopHandle?: string;
  }): Promise<{
    shopHandle: string;
    accessToken: string;
    grantedScopes: string[];
  }>;
}

export interface ResolveShoplineCliAuthInput {
  args: ShoplineCliArgs;
  env: Record<string, string | undefined>;
  store?: ShoplineCliAuthStore;
}

export interface ResolvedShoplineCliAuth {
  shopHandle: string;
  accessToken: string;
  source: "env" | "connection";
}

function arg(
  args: ShoplineCliArgs,
  name: string,
  env: Record<string, string | undefined>,
  envName?: string,
): string | undefined {
  const value = args[name];
  if (typeof value === "string" && value.length > 0) return value;
  if (envName && env[envName]) return env[envName];
  return undefined;
}

function createDefaultStore(): ShoplineCliAuthStore {
  const store = createSupabaseShoplineConnectionStore(createAdminClient());
  return {
    resolveConnectionToken: (input) =>
      resolveShoplineAccessToken(store, {
        companyId: input.companyId,
        websiteId: input.websiteId,
        shopHandle: input.shopHandle,
      }),
  };
}

export async function resolveShoplineCliAuth(
  input: ResolveShoplineCliAuthInput,
): Promise<ResolvedShoplineCliAuth> {
  const shopHandle = arg(
    input.args,
    "shop-handle",
    input.env,
    "SHOPLINE_SHOP_HANDLE",
  );
  const accessToken = arg(
    input.args,
    "access-token",
    input.env,
    "SHOPLINE_ACCESS_TOKEN",
  );

  if (shopHandle && accessToken) {
    return {
      shopHandle,
      accessToken,
      source: "env",
    };
  }

  const companyId = arg(
    input.args,
    "company-id",
    input.env,
    "SHOPLINE_COMPANY_ID",
  );
  const websiteId = arg(
    input.args,
    "website-id",
    input.env,
    "SHOPLINE_WEBSITE_ID",
  );
  const connectionShopHandle =
    shopHandle ?? arg(input.args, "connection-shop-handle", input.env);

  if (!companyId || (!websiteId && !connectionShopHandle)) {
    throw new Error("shopline_cli_auth_required");
  }

  const store = input.store ?? createDefaultStore();
  const resolved = await store.resolveConnectionToken({
    companyId,
    websiteId,
    shopHandle: connectionShopHandle,
  });

  return {
    shopHandle: resolved.shopHandle,
    accessToken: resolved.accessToken,
    source: "connection",
  };
}
