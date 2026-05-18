import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseShoplineConnectionStore,
  persistShoplineConnection,
} from "@/lib/shopline/connections";
import {
  exchangeCodeForToken,
  verifyShoplineHmac,
  verifyState,
} from "@/lib/shopline/oauth";

function normalizeShopHandle(shop: string): string {
  return shop.endsWith(".myshopline.com")
    ? shop.slice(0, -".myshopline.com".length)
    : shop;
}

function clearShoplineNonce(resp: NextResponse): NextResponse {
  resp.headers.set(
    "Set-Cookie",
    "shopline_oauth_nonce=; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth/shopline/callback; Max-Age=0",
  );
  return resp;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state =
    url.searchParams.get("state") ?? url.searchParams.get("customField");
  const shop = url.searchParams.get("shop") ?? url.searchParams.get("handle");
  const authorizationError = url.searchParams.get("error");

  if (authorizationError) {
    return clearShoplineNonce(
      NextResponse.json(
        {
          connected: false,
          error: "shopline_authorization_cancelled",
          reason: authorizationError,
        },
        { status: 400 },
      ),
    );
  }

  if (!code || !state || !shop) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const cookieNonce = req.cookies.get("shopline_oauth_nonce")?.value;
  if (!cookieNonce) {
    return NextResponse.json(
      { error: "missing_cookie_nonce" },
      { status: 401 },
    );
  }

  if (!(await verifyShoplineHmac(url.searchParams))) {
    return NextResponse.json(
      { error: "invalid_shopline_hmac" },
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

  const callbackShopHandle = normalizeShopHandle(shop);
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
    return NextResponse.json(
      { connected: false, error: "shopline_token_exchange_failed" },
      { status: 502 },
    );
  }

  const store = createSupabaseShoplineConnectionStore(createAdminClient());
  const connection = await persistShoplineConnection(store, {
    companyId: verified.workspaceId,
    websiteId: verified.siteId,
    shopHandle: verified.shopHandle,
    accessToken: token.access_token,
    scope: token.scope,
  });

  const resp = NextResponse.json({
    connected: true,
    shopHandle: connection.shopHandle ?? verified.shopHandle,
    scope: token.scope,
    tokenReceived: true,
    tokenStorage: "stored",
    connection,
  });
  return clearShoplineNonce(resp);
}
