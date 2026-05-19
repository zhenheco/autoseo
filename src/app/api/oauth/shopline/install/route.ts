import { NextResponse } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  buildAuthorizeUrl,
  normalizeShoplineShopHandle,
} from "@/lib/shopline/oauth";

export const GET = withRouteAuth(
  "company",
  async (req, { companyId, supabase }) => {
    const url = new URL(req.url);
    const shopHandleParam = url.searchParams.get("shopHandle");
    const siteId = url.searchParams.get("siteId");
    const returnTo = url.searchParams.get("returnTo") ?? undefined;

    if (!shopHandleParam) {
      return NextResponse.json(
        { error: "missing_shop_handle" },
        { status: 400 },
      );
    }

    if (!siteId) {
      return NextResponse.json({ error: "missing_site_id" }, { status: 400 });
    }

    let shopHandle: string;
    try {
      shopHandle = normalizeShoplineShopHandle(shopHandleParam);
    } catch {
      return NextResponse.json(
        { error: "invalid_shop_handle" },
        { status: 400 },
      );
    }

    const { data: website } = await supabase
      .from("website_configs")
      .select("id")
      .eq("id", siteId)
      .eq("company_id", companyId)
      .maybeSingle();

    if (!website) {
      return NextResponse.json({ error: "website_not_found" }, { status: 404 });
    }

    const { url: authorizeUrl, cookieNonce } = await buildAuthorizeUrl({
      workspaceId: companyId,
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
  },
);
