import { NextResponse, type NextRequest } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { forbidden, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseShoplineConnectionStore } from "@/lib/shopline/connections";
import { fetchShoplineProducts } from "@/lib/shopline/product-fetcher";
import {
  evaluateBatchSeoHealth,
  matchesSeoHealthFilter,
} from "@/lib/shopline/seo-health-evaluator";
import { ShoplineAuthError } from "@/lib/shopline/types";

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
      const filter =
        request.nextUrl?.searchParams.get("filter") ??
        new URL(request.url).searchParams.get("filter");
      const result = await fetchShoplineProducts(companyId, websiteId, cursor, {
        store: createSupabaseShoplineConnectionStore(adminClient),
      });
      const healthById = evaluateBatchSeoHealth(
        result.products.map((product) => ({
          id: product.id,
          entityType: "product" as const,
          entity: product,
        })),
      );
      const products = result.products.filter((product) => {
        const matches = matchesSeoHealthFilter(
          healthById.get(product.id) ?? [],
          filter,
        );
        return matches ?? true;
      });

      return NextResponse.json({ ...result, products });
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
