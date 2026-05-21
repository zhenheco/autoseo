import { NextRequest, NextResponse } from "next/server";
import {
  withRouteAuth,
  type CompanyRouteAuthContext,
} from "@/lib/api/route-auth";
import { ACTIVE_BRAND_COOKIE } from "@/lib/brands/constants";
import {
  buildXAuthorizeUrl,
  generatePkcePair,
  generateRandomBase64Url,
} from "@/lib/social/x/oauth";

const CALLBACK_COOKIE_PATH = "/api/social/x/callback";
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
    const clientId = process.env.X_CLIENT_ID;
    const redirectUri = process.env.X_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "x_oauth_not_configured" },
        { status: 500 },
      );
    }

    const brandId = await resolveBrandId(request, supabase, companyId);
    if (!brandId) {
      return NextResponse.json({ error: "brand_not_found" }, { status: 404 });
    }

    const { codeVerifier, codeChallenge } = await generatePkcePair();
    const state = generateRandomBase64Url(32);
    const authorizeUrl = buildXAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    });

    const response = NextResponse.redirect(authorizeUrl, { status: 302 });
    const options = cookieOptions();
    response.cookies.set("x_oauth_state", state, options);
    response.cookies.set("x_oauth_code_verifier", codeVerifier, options);
    response.cookies.set("x_oauth_brand_id", brandId, options);
    return response;
  },
);
