import { createAdminClient } from "@shared/supabase";
import type { TokenCrypto } from "@/lib/security/token-crypto";
import { getSocialTokenCrypto } from "@/lib/social/token-crypto";
import { refreshXOAuthTokens } from "./oauth";

type SocialAccountRow = {
  id: string;
  refresh_token_encrypted: string | null;
};

type SupabaseLike = ReturnType<typeof createAdminClient>;

export type RefreshXTokenResult = {
  accessToken: string;
  expiresAt: string;
};

export async function refreshXToken(
  socialAccountId: string,
  deps: {
    supabase?: SupabaseLike;
    tokenCrypto?: TokenCrypto;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RefreshXTokenResult> {
  const supabase = deps.supabase ?? createAdminClient();
  const tokenCrypto = deps.tokenCrypto ?? getSocialTokenCrypto();

  const { data: account, error: accountError } = (await supabase
    .from("social_accounts")
    .select("id, refresh_token_encrypted")
    .eq("id", socialAccountId)
    .eq("platform", "x")
    .maybeSingle()) as {
    data: SocialAccountRow | null;
    error: { message?: string } | null;
  };

  if (accountError || !account?.refresh_token_encrypted) {
    throw new Error("x_refresh_token_not_found");
  }

  const refreshToken = await tokenCrypto.decrypt(
    account.refresh_token_encrypted,
  );
  const tokens = await refreshXOAuthTokens({
    refreshToken,
    fetchImpl: deps.fetchImpl,
  });
  const accessTokenEncrypted = await tokenCrypto.encrypt(tokens.access_token);
  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000,
  ).toISOString();

  const updatePayload: {
    access_token_encrypted: string;
    refresh_token_encrypted?: string;
    token_expires_at: string;
    disconnected_at: null;
  } = {
    access_token_encrypted: accessTokenEncrypted,
    token_expires_at: expiresAt,
    disconnected_at: null,
  };

  if (tokens.refresh_token) {
    updatePayload.refresh_token_encrypted = await tokenCrypto.encrypt(
      tokens.refresh_token,
    );
  }

  const { error: updateError } = (await supabase
    .from("social_accounts")
    .update(updatePayload)
    .eq("id", socialAccountId)) as { error?: { message?: string } | null };

  if (updateError) {
    throw new Error("x_refresh_token_update_failed");
  }

  return {
    accessToken: tokens.access_token,
    expiresAt,
  };
}
