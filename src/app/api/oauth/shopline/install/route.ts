import { NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/shopline/oauth";

const SHOP_HANDLE_RE = /^[a-zA-Z0-9-]+$/;

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const shopHandle = url.searchParams.get("shopHandle");
  const workspaceId = url.searchParams.get("workspaceId");
  const siteId = url.searchParams.get("siteId");
  const returnTo = url.searchParams.get("returnTo") ?? undefined;

  if (!shopHandle) {
    return NextResponse.json({ error: "missing_shop_handle" }, { status: 400 });
  }

  if (!workspaceId || !siteId) {
    return NextResponse.json(
      { error: "missing_workspace_or_site" },
      { status: 400 },
    );
  }

  if (!SHOP_HANDLE_RE.test(shopHandle)) {
    return NextResponse.json({ error: "invalid_shop_handle" }, { status: 400 });
  }

  const { url: authorizeUrl, cookieNonce } = await buildAuthorizeUrl({
    workspaceId,
    siteId,
    shopHandle,
    returnTo,
  });

  const resp = NextResponse.redirect(authorizeUrl, { status: 302 });
  resp.headers.set(
    "Set-Cookie",
    `shopline_oauth_nonce=${cookieNonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth/shopline/callback; Max-Age=600`,
  );
  return resp;
}
