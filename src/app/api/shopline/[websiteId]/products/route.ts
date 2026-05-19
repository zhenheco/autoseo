import { NextResponse, type NextRequest } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { forbidden, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseShoplineConnectionStore } from "@/lib/shopline/connections";
import { fetchShoplineProducts } from "@/lib/shopline/product-fetcher";

type RouteContext = {
  params: Promise<{
    websiteId: string;
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
  async (request: NextRequest, { companyId }, context: RouteContext) => {
    try {
      const { websiteId } = await context.params;
      const adminClient = createAdminClient();
      const ownsWebsite = await assertWebsiteOwner(
        adminClient,
        companyId,
        websiteId,
      );

      if (!ownsWebsite) {
        return forbidden("Website not found");
      }

      const cursor =
        request.nextUrl?.searchParams.get("cursor") ??
        new URL(request.url).searchParams.get("cursor") ??
        undefined;
      const result = await fetchShoplineProducts(companyId, websiteId, cursor, {
        store: createSupabaseShoplineConnectionStore(adminClient),
      });

      return NextResponse.json(result);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "shopline_no_connection"
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
