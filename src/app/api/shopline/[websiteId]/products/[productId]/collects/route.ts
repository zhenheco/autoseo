import { NextResponse, type NextRequest } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { forbidden, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSupabaseShoplineConnectionStore,
  resolveShoplineAccessToken,
} from "@/lib/shopline/connections";
import { ShoplineClient } from "@/lib/shopline/client";
import { ShoplineAuthError } from "@/lib/shopline/types";

type RouteContext = {
  params: Promise<{
    websiteId: string;
    productId: string;
  }>;
};

async function assertWebsiteOwner(
  adminClient: ReturnType<typeof createAdminClient>,
  companyId: string,
  websiteId: string,
) {
  const { data: website, error } = await adminClient
    .from("website_configs")
    .select("id")
    .eq("id", websiteId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(website);
}

export const GET = withRouteAuth(
  "company",
  async (_request: NextRequest, { companyId }, context: RouteContext) => {
    try {
      const { websiteId, productId } = await context.params;
      const adminClient = createAdminClient();
      const ownsWebsite = await assertWebsiteOwner(
        adminClient,
        companyId,
        websiteId,
      );

      if (!ownsWebsite) {
        return forbidden("Website not found");
      }

      const store = createSupabaseShoplineConnectionStore(adminClient);
      const auth = await resolveShoplineAccessToken(store, {
        companyId,
        websiteId,
      });
      const client = new ShoplineClient({
        shopHandle: auth.shopHandle,
        accessToken: auth.accessToken,
      });

      return NextResponse.json(await client.listProductCollects(productId));
    } catch (error) {
      if (
        error instanceof ShoplineAuthError ||
        (error instanceof Error &&
          (error.name === "ShoplineAuthError" ||
            error.message === "shopline_auth_invalid"))
      ) {
        const { websiteId } = await context.params;

        return NextResponse.json(
          {
            error: "shopline_auth_invalid",
            reauthorize_url: `/api/oauth/shopline/install?siteId=${encodeURIComponent(
              websiteId,
            )}`,
          },
          { status: 502 },
        );
      }

      if (
        error instanceof Error &&
        (error.message === "shopline_connection_not_found" ||
          error.message === "shopline_connection_token_missing")
      ) {
        return NextResponse.json(
          { error: "shopline_no_connection" },
          { status: 404 },
        );
      }

      return handleApiError(error);
    }
  },
);
