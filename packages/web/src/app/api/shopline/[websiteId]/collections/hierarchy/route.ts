import { NextResponse, type NextRequest } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { forbidden, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@shared/supabase";
import { getCollectionHierarchy } from "@/lib/shopline/collection-hierarchy-service";

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
  async (
    _request: NextRequest,
    { companyId, supabase },
    context: RouteContext,
  ) => {
    try {
      const { websiteId } = await context.params;
      const adminClient = createAdminClient();
      const ownsWebsite = await assertWebsiteOwner(
        adminClient,
        companyId,
        websiteId,
      );

      if (!ownsWebsite) return forbidden("Website not found");

      const hierarchy = await getCollectionHierarchy(supabase, websiteId);
      return NextResponse.json({ hierarchy });
    } catch (error) {
      return handleApiError(error);
    }
  },
);
