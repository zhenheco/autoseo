import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import {
  HTTP_STATUS,
  internalError,
  successResponse,
  validationError,
} from "@/lib/api/response-helpers";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  DEFAULT_BRAND_PLAN_ID,
  getBrandQuota,
  normalizeBrandPlanId,
} from "@/lib/brands/brand-quota";
import { brandMemoryFieldsSchema } from "@/lib/brands/memory-schema";
import type { CompanyRouteAuthContext } from "@/lib/api/route-auth";
import type { Database } from "@/types/database.types";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
type BrandSupabaseClient = Pick<CompanyRouteAuthContext["supabase"], "from">;

const BRAND_SELECT =
  "id, company_id, name, voice_tone, target_audience, value_props, brand_guidelines, logo_url, primary_color, secondary_color, is_default, created_at, updated_at, deleted_at, automation_level, auto_articles_per_week, auto_publish_to_social";

const UPGRADE_URL = "/dashboard/billing";

const createBrandSchema = brandMemoryFieldsSchema
  .omit({
    automationLevel: true,
    autoArticlesPerWeek: true,
    autoPublishToSocial: true,
  })
  .extend({
    name: z.string().trim().min(1),
  });

function brandInputToInsert(
  companyId: string,
  input: z.output<typeof createBrandSchema>,
): BrandInsert {
  return {
    company_id: companyId,
    name: input.name,
    voice_tone: input.voiceTone ?? null,
    target_audience: input.targetAudience ?? null,
    value_props: input.valueProps ?? null,
    brand_guidelines: input.brandGuidelines ?? null,
    logo_url: input.logoUrl ?? null,
    primary_color: input.primaryColor ?? null,
    secondary_color: input.secondaryColor ?? null,
    is_default: false,
  };
}

type CompanySubscriptionSelection = {
  billing_cycle: string | null;
  subscription_plans:
    | {
        slug: string | null;
      }
    | Array<{
        slug: string | null;
      }>
    | null;
};

function getPlanSlug(
  subscriptionPlans: CompanySubscriptionSelection["subscription_plans"],
): string | null {
  if (Array.isArray(subscriptionPlans)) {
    return subscriptionPlans[0]?.slug ?? null;
  }

  return subscriptionPlans?.slug ?? null;
}

async function resolveCurrentBrandPlanId(
  supabase: BrandSupabaseClient,
  companyId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("company_subscriptions")
    .select("billing_cycle, subscription_plans(slug)")
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn("[Brands] Failed to resolve subscription plan:", error);
    }
    return DEFAULT_BRAND_PLAN_ID;
  }

  const subscription = data as CompanySubscriptionSelection;
  return normalizeBrandPlanId(
    getPlanSlug(subscription.subscription_plans),
    subscription.billing_cycle,
  );
}

export const GET = withRouteAuth(
  "company",
  async (_request: NextRequest, { supabase, companyId }) => {
    const { data, error } = await supabase
      .from("brands")
      .select(BRAND_SELECT)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[Brands] List failed:", error);
      return internalError("Failed to list brands");
    }

    return successResponse((data ?? []) as BrandRow[]);
  },
);

export const POST = withRouteAuth(
  "company",
  async (request: NextRequest, { supabase, companyId }) => {
    const bodyResult = await safeJson(request);
    if (!bodyResult.success) {
      return requestErrorResponse(bodyResult.error);
    }

    const parsed = createBrandSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return validationError("Invalid brand payload", parsed.error.flatten());
    }

    const currentPlan = await resolveCurrentBrandPlanId(supabase, companyId);
    const brandsCap = getBrandQuota(currentPlan);
    const { count, error: countError } = await supabase
      .from("brands")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (countError) {
      console.error("[Brands] Quota count failed:", countError);
      return internalError("Failed to check brand quota");
    }

    const brandsUsed = count ?? 0;
    if (brandsUsed >= brandsCap) {
      return NextResponse.json(
        {
          error: "quota_exceeded",
          currentPlan,
          brandsUsed,
          brandsCap,
          upgradeUrl: UPGRADE_URL,
        },
        { status: HTTP_STATUS.PAYMENT_REQUIRED },
      );
    }

    const { data, error } = await supabase
      .from("brands")
      .insert(brandInputToInsert(companyId, parsed.data))
      .select(BRAND_SELECT)
      .single();

    if (error || !data) {
      console.error("[Brands] Create failed:", error);
      return internalError("Failed to create brand");
    }

    return successResponse(data as BrandRow, undefined, HTTP_STATUS.CREATED);
  },
);
