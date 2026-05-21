import { NextRequest, NextResponse } from "next/server";
import {
  withRouteAuth,
  type CompanyRouteAuthContext,
} from "@/lib/api/route-auth";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brands/constants";
import {
  buildMetaAuthorizeUrl,
  generateMetaState,
} from "@/lib/social/meta/oauth";

const CALLBACK_COOKIE_PATH = "/api/social/meta/callback";
const COOKIE_MAX_AGE_SECONDS = 10 * 60;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: CALLBACK_COOKIE_PATH,
  };
}

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

async function resolveBrandId(
  request: NextRequest,
  supabase: CompanyRouteAuthContext["supabase"],
  companyId: string,
): Promise<string | null> {
  const requestedBrandId =
    request.nextUrl.searchParams.get("brand_id") ??
    request.nextUrl.searchParams.get("brand") ??
    request.cookies.get(ACTIVE_BRAND_COOKIE)?.value;

  let query = supabase
    .from("brands")
    .select("id")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  if (requestedBrandId) {
    query = query.eq("id", requestedBrandId);
  } else {
    query = query.order("created_at", { ascending: true }).limit(1);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

export const GET = withRouteAuth(
  "company",
  async (request: NextRequest, { supabase, companyId }) => {
    if (process.env.META_OAUTH_PUBLIC_ENABLED !== "true") {
      return redirectToSocial(request, { meta_pending_review: "1" });
    }

    const appId = process.env.META_APP_ID;
    const redirectUri = process.env.META_REDIRECT_URI;

    if (!appId || !redirectUri) {
      return NextResponse.json(
        { error: "meta_oauth_not_configured" },
        { status: 500 },
      );
    }

    const brandId = await resolveBrandId(request, supabase, companyId);
    if (!brandId) {
      return NextResponse.json({ error: "brand_not_found" }, { status: 404 });
    }

    const state = generateMetaState();
    const authorizeUrl = buildMetaAuthorizeUrl({
      appId,
      redirectUri,
      state,
    });

    const response = NextResponse.redirect(authorizeUrl, { status: 302 });
    const options = cookieOptions();
    response.cookies.set("meta_oauth_state", state, options);
    response.cookies.set("meta_oauth_brand_id", brandId, options);
    return response;
  },
);
