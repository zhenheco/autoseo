import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@shared/supabase";
import { getSocialTokenCrypto } from "@/lib/social/token-crypto";
import { serializeMetaRefreshSource } from "@/lib/social/meta/refresh";
import {
  exchangeMetaCodeForShortLivedToken,
  exchangeMetaTokenForLongLivedToken,
  fetchMetaMeWithAccounts,
  fetchMetaPageAccess,
  fetchThreadsProfile,
  type MetaInstagramBusinessAccount,
  type MetaPage,
} from "@/lib/social/meta/oauth";

const CALLBACK_COOKIE_PATH = "/api/social/meta/callback";

type SocialAccountUpsert = {
  brand_id: string;
  platform: "facebook" | "instagram" | "threads";
  platform_account_id: string;
  platform_username: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  connected_at: string;
  disconnected_at: null;
};

function redirectToSocial(
  request: NextRequest,
  params: Record<string, string>,
): NextResponse {
  const url = new URL("/dashboard/social", request.url);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url, { status: 302 });
}

function clearOAuthCookies(response: NextResponse): NextResponse {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 0,
    path: CALLBACK_COOKIE_PATH,
  };

  response.cookies.set("meta_oauth_state", "", options);
  response.cookies.set("meta_oauth_brand_id", "", options);
  return response;
}

async function userCanAccessBrand(brandId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data, error } = await supabase
    .from("brands")
    .select("id, company_id")
    .eq("id", brandId)
    .maybeSingle();

  if (error || !data?.company_id) return false;

  const { data: membership, error: membershipError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("company_id", data.company_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) return false;
  return Boolean(membership);
}

function tokenExpiry(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function pageName(page: MetaPage): string | null {
  return page.username ?? page.name ?? null;
}

function instagramName(account: MetaInstagramBusinessAccount): string | null {
  return account.username ?? account.name ?? null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const authorizationError = request.nextUrl.searchParams.get("error");
  const savedState = request.cookies.get("meta_oauth_state")?.value;
  const brandId = request.cookies.get("meta_oauth_brand_id")?.value;

  if (authorizationError) {
    return clearOAuthCookies(
      redirectToSocial(request, { error: authorizationError }),
    );
  }

  if (!state || !savedState || state !== savedState) {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "invalid_state" }),
    );
  }

  if (!brandId) {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "missing_brand" }),
    );
  }

  if (!code) {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "missing_code" }),
    );
  }

  const redirectUri = process.env.META_REDIRECT_URI;
  if (!redirectUri) {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "server_config_error" }),
    );
  }

  try {
    if (!(await userCanAccessBrand(brandId))) {
      return clearOAuthCookies(
        redirectToSocial(request, { error: "unauthorized" }),
      );
    }

    const shortLived = await exchangeMetaCodeForShortLivedToken({
      code,
      redirectUri,
    });
    const longLived = await exchangeMetaTokenForLongLivedToken({
      accessToken: shortLived.access_token,
    });
    const expiresAt = tokenExpiry(longLived.expires_in);
    const connectedAt = new Date().toISOString();
    const tokenCrypto = getSocialTokenCrypto();
    const encryptedLongLivedUserToken = await tokenCrypto.encrypt(
      longLived.access_token,
    );

    const me = await fetchMetaMeWithAccounts({
      accessToken: longLived.access_token,
    });
    const pages = me.accounts?.data ?? [];
    const rows: SocialAccountUpsert[] = [];

    for (const page of pages) {
      const pageAccess = await fetchMetaPageAccess({
        pageId: page.id,
        userAccessToken: longLived.access_token,
      });
      if (!pageAccess.access_token) {
        throw new Error("meta_page_access_lookup_invalid");
      }
      const encryptedPageToken = await tokenCrypto.encrypt(
        pageAccess.access_token,
      );
      const encryptedPageRefreshSource = await tokenCrypto.encrypt(
        serializeMetaRefreshSource({
          userAccessToken: longLived.access_token,
          pageId: pageAccess.id,
        }),
      );

      rows.push({
        brand_id: brandId,
        platform: "facebook",
        platform_account_id: pageAccess.id,
        platform_username: pageName(pageAccess),
        access_token_encrypted: encryptedPageToken,
        refresh_token_encrypted: encryptedPageRefreshSource,
        token_expires_at: expiresAt,
        connected_at: connectedAt,
        disconnected_at: null,
      });

      if (pageAccess.instagram_business_account?.id) {
        rows.push({
          brand_id: brandId,
          platform: "instagram",
          platform_account_id: pageAccess.instagram_business_account.id,
          platform_username: instagramName(
            pageAccess.instagram_business_account,
          ),
          access_token_encrypted: encryptedPageToken,
          refresh_token_encrypted: encryptedPageRefreshSource,
          token_expires_at: expiresAt,
          connected_at: connectedAt,
          disconnected_at: null,
        });
      }
    }

    try {
      const threadsProfile = await fetchThreadsProfile({
        accessToken: longLived.access_token,
      });
      rows.push({
        brand_id: brandId,
        platform: "threads",
        platform_account_id: threadsProfile.id,
        platform_username:
          threadsProfile.username ?? threadsProfile.name ?? null,
        access_token_encrypted: encryptedLongLivedUserToken,
        refresh_token_encrypted: encryptedLongLivedUserToken,
        token_expires_at: expiresAt,
        connected_at: connectedAt,
        disconnected_at: null,
      });
    } catch {
      // A Meta login can connect Pages/Instagram without an eligible Threads profile.
    }

    if (rows.length === 0) {
      return clearOAuthCookies(
        redirectToSocial(request, { error: "no_meta_accounts" }),
      );
    }

    const { error: upsertError } = await createAdminClient()
      .from("social_accounts")
      .upsert(rows, { onConflict: "brand_id,platform,platform_account_id" });

    if (upsertError) {
      return clearOAuthCookies(
        redirectToSocial(request, { error: "storage_failed" }),
      );
    }

    return clearOAuthCookies(redirectToSocial(request, { connected: "meta" }));
  } catch {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "server_error" }),
    );
  }
}
