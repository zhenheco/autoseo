import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import {
  createSupabaseShoplineConnectionStore,
  persistShoplineConnection,
} from "@/lib/shopline/connections";
import {
  createSupabaseShoplineInvitationStore,
  redeemInvitation,
} from "@/lib/shopline/invitations";
import {
  exchangeCodeForToken,
  normalizeShoplineShopHandle,
  verifyShoplineHmac,
  verifyState,
  type VerifiedShoplineOAuthState,
} from "@/lib/shopline/oauth";

function clearShoplineNonce(resp: NextResponse): NextResponse {
  resp.headers.set(
    "Set-Cookie",
    "shopline_oauth_nonce=; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth/shopline/callback; Max-Age=0",
  );
  return resp;
}

function getSafeReturnPath(verified: VerifiedShoplineOAuthState): string {
  const fallback = `/dashboard/websites/${verified.siteId}/shopline`;
  const returnTo = verified.returnTo;
  if (!returnTo) return fallback;
  if (!returnTo.startsWith("/") || returnTo.startsWith("//")) return fallback;
  return returnTo;
}

function redirectWithShoplineResult(
  req: NextRequest,
  verified: VerifiedShoplineOAuthState,
  params: Record<string, string>,
): NextResponse {
  const destination = new URL(getSafeReturnPath(verified), req.url);

  for (const [key, value] of Object.entries(params)) {
    destination.searchParams.set(key, value);
  }

  return clearShoplineNonce(
    NextResponse.redirect(destination, { status: 302 }),
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state =
    url.searchParams.get("state") ?? url.searchParams.get("customField");
  const shop = url.searchParams.get("shop") ?? url.searchParams.get("handle");
  const authorizationError = url.searchParams.get("error");

  if (!state) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const cookieNonce = req.cookies.get("shopline_oauth_nonce")?.value;
  if (!cookieNonce) {
    return NextResponse.json(
      { error: "missing_cookie_nonce" },
      { status: 401 },
    );
  }

  let verified;
  try {
    verified = await verifyState(state, cookieNonce);
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_state",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 401 },
    );
  }

  if (authorizationError) {
    return redirectWithShoplineResult(req, verified, {
      shopline: "cancelled",
      reason: authorizationError,
    });
  }

  if (!code || !shop) {
    return redirectWithShoplineResult(req, verified, {
      shopline: "error",
      error: "missing_params",
    });
  }

  if (!(await verifyShoplineHmac(url.searchParams))) {
    return NextResponse.json(
      { error: "invalid_shopline_hmac" },
      { status: 401 },
    );
  }

  let callbackShopHandle: string;
  try {
    callbackShopHandle = normalizeShoplineShopHandle(shop);
  } catch {
    return NextResponse.json({ error: "invalid_shop_handle" }, { status: 400 });
  }

  if (callbackShopHandle !== verified.shopHandle) {
    return NextResponse.json(
      { error: "shop_handle_mismatch" },
      { status: 401 },
    );
  }

  let token;
  try {
    token = await exchangeCodeForToken(verified.shopHandle, code);
  } catch {
    return redirectWithShoplineResult(req, verified, {
      shopline: "error",
      error: "shopline_token_exchange_failed",
    });
  }

  const admin = createAdminClient();
  const store = createSupabaseShoplineConnectionStore(admin);
  const connection = await persistShoplineConnection(store, {
    companyId: verified.workspaceId,
    websiteId: verified.siteId,
    shopHandle: verified.shopHandle,
    accessToken: token.access_token,
    scope: token.scope,
  });

  if (verified.invitationToken) {
    try {
      await redeemInvitation(
        createSupabaseShoplineInvitationStore(admin),
        verified.invitationToken,
      );
    } catch (error) {
      console.warn("shopline_invitation_redeem_failed", {
        invitationToken: verified.invitationToken,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return redirectWithShoplineResult(req, verified, {
    shopline: "connected",
    shopHandle: connection.shopHandle ?? verified.shopHandle,
  });
}
