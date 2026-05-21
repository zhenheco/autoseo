import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@shared/supabase";
import { getSocialTokenCrypto } from "@/lib/social/token-crypto";
import {
  exchangeAuthorizationCodeForXTokens,
  fetchXUserMe,
} from "@/lib/social/x/oauth";

const CALLBACK_COOKIE_PATH = "/api/social/x/callback";

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

  response.cookies.set("x_oauth_state", "", options);
  response.cookies.set("x_oauth_code_verifier", "", options);
  response.cookies.set("x_oauth_brand_id", "", options);
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const authorizationError = request.nextUrl.searchParams.get("error");
  const savedState = request.cookies.get("x_oauth_state")?.value;
  const codeVerifier = request.cookies.get("x_oauth_code_verifier")?.value;
  const brandId = request.cookies.get("x_oauth_brand_id")?.value;

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

  if (!codeVerifier) {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "missing_code_verifier" }),
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

  const redirectUri = process.env.X_REDIRECT_URI;
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

    const tokens = await exchangeAuthorizationCodeForXTokens({
      code,
      codeVerifier,
      redirectUri,
    });
    const xUser = await fetchXUserMe(tokens.access_token);
    const tokenCrypto = getSocialTokenCrypto();
    const accessTokenEncrypted = await tokenCrypto.encrypt(tokens.access_token);
    const refreshTokenEncrypted = tokens.refresh_token
      ? await tokenCrypto.encrypt(tokens.refresh_token)
      : null;

    const { error: upsertError } = await createAdminClient()
      .from("social_accounts")
      .upsert(
        {
          brand_id: brandId,
          platform: "x",
          platform_account_id: xUser.id,
          platform_username: xUser.username ?? null,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000,
          ).toISOString(),
          connected_at: new Date().toISOString(),
          disconnected_at: null,
        },
        { onConflict: "brand_id,platform,platform_account_id" },
      );

    if (upsertError) {
      return clearOAuthCookies(
        redirectToSocial(request, { error: "storage_failed" }),
      );
    }

    return clearOAuthCookies(redirectToSocial(request, { connected: "x" }));
  } catch {
    return clearOAuthCookies(
      redirectToSocial(request, { error: "server_error" }),
    );
  }
}
