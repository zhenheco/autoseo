import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseShoplineInvitationStore,
  findActiveInvitation,
} from "@/lib/shopline/invitations";
import {
  buildAuthorizeUrl,
  normalizeShoplineShopHandle,
} from "@/lib/shopline/oauth";

type RouteContext = {
  params: Promise<{ token: string }> | { token: string };
};

export async function GET(
  req: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { token } = await context.params;
  const url = new URL(req.url);
  const shopHandleParam = url.searchParams.get("shopHandle");

  if (!shopHandleParam) {
    return NextResponse.json({ error: "missing_shop_handle" }, { status: 400 });
  }

  let shopHandle: string;
  try {
    shopHandle = normalizeShoplineShopHandle(shopHandleParam);
  } catch {
    return NextResponse.json({ error: "invalid_shop_handle" }, { status: 400 });
  }

  const admin = createAdminClient();
  const invitationStore = createSupabaseShoplineInvitationStore(admin);
  let invitation;
  try {
    invitation = await findActiveInvitation(invitationStore, token);
  } catch (error) {
    const reason = getInvitationErrorReason(error);
    return NextResponse.redirect(
      new URL(`/connect/shopline/${token}?error=${reason}`, req.url),
      { status: 302 },
    );
  }

  const websiteUrl = `https://${shopHandle}.myshopline.com`;
  const { data: existingWebsite } = await admin
    .from("website_configs")
    .select("id")
    .eq("company_id", invitation.companyId)
    .eq("wordpress_url", websiteUrl)
    .maybeSingle();

  const existingWebsiteId = (existingWebsite as { id?: string } | null)?.id;
  let websiteId: string;
  if (existingWebsiteId) {
    websiteId = existingWebsiteId;
  } else {
    const { data: createdWebsite, error } = await admin
      .from("website_configs")
      .insert({
        company_id: invitation.companyId,
        website_name: shopHandle,
        wordpress_url: websiteUrl,
        website_type: "external",
        wp_enabled: false,
        is_active: true,
        language: "zh-TW",
        brand_voice: {},
        created_by: null,
      })
      .select("id")
      .single();

    if (error || !createdWebsite?.id) {
      return NextResponse.json(
        { error: "website_config_create_failed" },
        { status: 500 },
      );
    }

    websiteId = createdWebsite.id;
  }

  const { url: authorizeUrl, cookieNonce } = await buildAuthorizeUrl({
    workspaceId: invitation.companyId,
    siteId: websiteId,
    shopHandle,
    returnTo: `/connect/shopline/${token}/done?shop=${encodeURIComponent(shopHandle)}`,
    invitationToken: token,
  });

  const resp = NextResponse.redirect(authorizeUrl, { status: 302 });
  resp.headers.set(
    "Set-Cookie",
    `shopline_oauth_nonce=${cookieNonce}; HttpOnly; Secure; SameSite=Lax; Path=/api/oauth/shopline/callback; Max-Age=600`,
  );
  return resp;
}

function getInvitationErrorReason(
  error: unknown,
): "invalid" | "expired" | "revoked" {
  if (!(error instanceof Error)) return "invalid";
  if (error.message === "shopline_invitation_expired") return "expired";
  if (error.message === "shopline_invitation_revoked") return "revoked";
  return "invalid";
}
