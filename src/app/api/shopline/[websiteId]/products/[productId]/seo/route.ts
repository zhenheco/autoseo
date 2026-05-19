import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  forbidden,
  handleApiError,
  validationError,
} from "@/lib/api/response-helpers";
import { safeJson } from "@/lib/api/request-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseShoplineConnectionStore } from "@/lib/shopline/connections";
import { updateShoplineProductSeo } from "@/lib/shopline/seo-updater";
import { ShoplineAuthError } from "@/lib/shopline/types";

type RouteContext = {
  params: Promise<{
    websiteId: string;
    productId: string;
  }>;
};

const ProductSeoPatchSchema = z.object({
  seo: z
    .object({
      title: z.string().max(70).optional(),
      description: z.string().max(160).optional(),
    })
    .optional(),
  handle: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  title: z.string().optional(),
});

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

export const PATCH = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { companyId, user, supabase },
    context: RouteContext,
  ) => {
    const request = _request as Pick<Request, "json"> & NextRequest;

    try {
      const { websiteId, productId } = await context.params;
      const bodyResult = await safeJson<unknown>(request);

      if (!bodyResult.success) {
        return NextResponse.json(
          {
            error: bodyResult.error.message,
            code: bodyResult.error.code,
          },
          { status: 400 },
        );
      }

      const parsedBody = ProductSeoPatchSchema.safeParse(bodyResult.data);
      if (!parsedBody.success) {
        return validationError(
          "Invalid request body",
          parsedBody.error.flatten(),
        );
      }

      const adminClient = createAdminClient();
      const ownsWebsite = await assertWebsiteOwner(
        adminClient,
        companyId,
        websiteId,
      );

      if (!ownsWebsite) {
        return forbidden("Website not found");
      }

      const updatedProduct = await updateShoplineProductSeo(
        companyId,
        websiteId,
        productId,
        { ...parsedBody.data, source: "ui" },
        {
          store: createSupabaseShoplineConnectionStore(adminClient),
          auditOptions: {
            supabase,
            userId: user.id,
            source: "ui",
          },
        },
      );

      return NextResponse.json(updatedProduct);
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
