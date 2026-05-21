import { createAdminClient } from "@shared/supabase";
import type { TokenCrypto } from "@/lib/security/token-crypto";
import { getSocialTokenCrypto } from "@/lib/social/token-crypto";
import {
  exchangeMetaTokenForLongLivedToken,
  fetchMetaPageAccess,
} from "./oauth";

const META_PLATFORMS = ["facebook", "instagram", "threads"] as const;
const REFRESH_WINDOW_DAYS = 7;
const MAX_REFRESH_BATCH_SIZE = 100;

type SupabaseLike = ReturnType<typeof createAdminClient>;

type SocialAccountRow = {
  id: string;
  platform: "facebook" | "instagram" | "threads";
  platform_account_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
};

type MetaRefreshSource = {
  userAccessToken: string;
  pageId?: string;
};

export type RefreshMetaTokenResult = {
  accessToken: string;
  expiresAt: string;
};

export type MetaTokenRefreshSummary = {
  checked: number;
  refreshed: number;
  failed: number;
};

export function serializeMetaRefreshSource(source: MetaRefreshSource): string {
  return JSON.stringify(source);
}

function parseMetaRefreshSource(
  value: string,
  account: SocialAccountRow,
): MetaRefreshSource {
  try {
    const parsed = JSON.parse(value) as Partial<MetaRefreshSource>;
    if (parsed && typeof parsed.userAccessToken === "string") {
      return {
        userAccessToken: parsed.userAccessToken,
        pageId: typeof parsed.pageId === "string" ? parsed.pageId : undefined,
      };
    }
  } catch {
    // Backward-compatible fallback for rows that stored only the token string.
  }

  return {
    userAccessToken: value,
    pageId:
      account.platform === "facebook" ? account.platform_account_id : undefined,
  };
}

export async function refreshMetaToken(
  socialAccountId: string,
  deps: {
    supabase?: SupabaseLike;
    tokenCrypto?: TokenCrypto;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RefreshMetaTokenResult> {
  const supabase = deps.supabase ?? createAdminClient();
  const tokenCrypto = deps.tokenCrypto ?? getSocialTokenCrypto();

  const { data: account, error: accountError } = (await supabase
    .from("social_accounts")
    .select(
      "id, platform, platform_account_id, access_token_encrypted, refresh_token_encrypted",
    )
    .eq("id", socialAccountId)
    .in("platform", [...META_PLATFORMS])
    .maybeSingle()) as {
    data: SocialAccountRow | null;
    error: { message?: string } | null;
  };

  if (accountError || !account?.access_token_encrypted) {
    throw new Error("meta_refresh_token_not_found");
  }

  const encryptedRefreshSource =
    account.refresh_token_encrypted ?? account.access_token_encrypted;
  const refreshSource = parseMetaRefreshSource(
    await tokenCrypto.decrypt(encryptedRefreshSource),
    account,
  );
  const tokens = await exchangeMetaTokenForLongLivedToken({
    accessToken: refreshSource.userAccessToken,
    fetchImpl: deps.fetchImpl,
  });
  let freshAccessToken = tokens.access_token;

  if (refreshSource.pageId) {
    const pageAccess = await fetchMetaPageAccess({
      pageId: refreshSource.pageId,
      userAccessToken: tokens.access_token,
      fetchImpl: deps.fetchImpl,
    });
    freshAccessToken = pageAccess.access_token ?? tokens.access_token;
  }

  const accessTokenEncrypted = await tokenCrypto.encrypt(freshAccessToken);
  const refreshSourceEncrypted = await tokenCrypto.encrypt(
    serializeMetaRefreshSource({
      userAccessToken: tokens.access_token,
      pageId: refreshSource.pageId,
    }),
  );
  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString();

  const { error: updateError } = (await supabase
    .from("social_accounts")
    .update({
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshSourceEncrypted,
      token_expires_at: expiresAt,
      disconnected_at: null,
    })
    .eq("id", socialAccountId)) as { error?: { message?: string } | null };

  if (updateError) {
    throw new Error("meta_refresh_token_update_failed");
  }

  return {
    accessToken: freshAccessToken,
    expiresAt,
  };
}

export async function refreshExpiringMetaTokens(
  deps: {
    supabase?: SupabaseLike;
    tokenCrypto?: TokenCrypto;
    fetchImpl?: typeof fetch;
    refreshImpl?: (
      socialAccountId: string,
      deps: {
        supabase?: SupabaseLike;
        tokenCrypto?: TokenCrypto;
        fetchImpl?: typeof fetch;
      },
    ) => Promise<RefreshMetaTokenResult>;
    now?: Date;
    limit?: number;
  } = {},
): Promise<MetaTokenRefreshSummary> {
  const supabase = deps.supabase ?? createAdminClient();
  const now = deps.now ?? new Date();
  const refreshBefore = new Date(
    now.getTime() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const refreshImpl = deps.refreshImpl ?? refreshMetaToken;

  const { data: accounts, error } = (await supabase
    .from("social_accounts")
    .select("id")
    .in("platform", [...META_PLATFORMS])
    .is("disconnected_at", null)
    .not("token_expires_at", "is", null)
    .lt("token_expires_at", refreshBefore)
    .limit(deps.limit ?? MAX_REFRESH_BATCH_SIZE)) as {
    data: Array<{ id: string }> | null;
    error: { message?: string } | null;
  };

  if (error) {
    throw new Error("meta_refresh_scan_failed");
  }

  let refreshed = 0;
  let failed = 0;

  for (const account of accounts ?? []) {
    try {
      await refreshImpl(account.id, {
        supabase,
        tokenCrypto: deps.tokenCrypto,
        fetchImpl: deps.fetchImpl,
      });
      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.error("[Meta Token Refresh] Failed to refresh account", {
        socialAccountId: account.id,
        error: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }

  return {
    checked: accounts?.length ?? 0,
    refreshed,
    failed,
  };
}
