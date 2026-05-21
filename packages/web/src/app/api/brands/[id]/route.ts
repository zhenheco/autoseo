import { NextRequest } from "next/server";
import { z } from "zod";
import { requestErrorResponse } from "@/lib/api/request-error-response";
import { safeJson } from "@/lib/api/request-body";
import {
  internalError,
  notFound,
  successResponse,
  validationError,
} from "@/lib/api/response-helpers";
import { withRouteAuth } from "@/lib/api/route-auth";
import { brandMemoryPatchSchema } from "@/lib/brands/memory-schema";
import type { Database } from "@/types/database.types";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];
type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];
type RouteParams = { params: Promise<{ id: string }> };

const BRAND_SELECT =
  "id, company_id, name, voice_tone, target_audience, value_props, brand_guidelines, logo_url, primary_color, secondary_color, is_default, created_at, updated_at, deleted_at, automation_level, auto_articles_per_week, auto_publish_to_social";

const brandIdSchema = z.string().uuid();

async function readBrandId(route: RouteParams): Promise<string | null> {
  const { id } = await route.params;
  const parsed = brandIdSchema.safeParse(id);
  return parsed.success ? parsed.data : null;
}

function brandInputToUpdate(
  input: z.output<typeof brandMemoryPatchSchema>,
): BrandUpdate {
  const update: BrandUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) update.name = input.name;
  if (input.voiceTone !== undefined) update.voice_tone = input.voiceTone;
  if (input.targetAudience !== undefined) {
    update.target_audience = input.targetAudience;
  }
  if (input.valueProps !== undefined) update.value_props = input.valueProps;
  if (input.brandGuidelines !== undefined) {
    update.brand_guidelines = input.brandGuidelines;
  }
  if (input.logoUrl !== undefined) update.logo_url = input.logoUrl;
  if (input.primaryColor !== undefined) {
    update.primary_color = input.primaryColor;
  }
  if (input.secondaryColor !== undefined) {
    update.secondary_color = input.secondaryColor;
  }
  if (input.automationLevel !== undefined) {
    update.automation_level = input.automationLevel;
  }
  if (input.autoArticlesPerWeek !== undefined) {
    update.auto_articles_per_week = input.autoArticlesPerWeek;
  }
  if (input.autoPublishToSocial !== undefined) {
    update.auto_publish_to_social = input.autoPublishToSocial;
  }

  return update;
}

export const GET = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { supabase, companyId },
    route: RouteParams,
  ) => {
    const id = await readBrandId(route);
    if (!id) {
      return validationError("Invalid brand id format");
    }

    const { data, error } = await supabase
      .from("brands")
      .select(BRAND_SELECT)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      console.error("[Brands] Read failed:", error);
      return internalError("Failed to read brand");
    }

    if (!data) {
      return notFound("Brand");
    }

    return successResponse(data as BrandRow);
  },
);

export const PATCH = withRouteAuth(
  "company",
  async (request: NextRequest, { supabase, companyId }, route: RouteParams) => {
    const id = await readBrandId(route);
    if (!id) {
      return validationError("Invalid brand id format");
    }

    const bodyResult = await safeJson(request);
    if (!bodyResult.success) {
      return requestErrorResponse(bodyResult.error);
    }

    const parsed = brandMemoryPatchSchema.safeParse(bodyResult.data);
    if (!parsed.success) {
      return validationError("Invalid brand payload", parsed.error.flatten());
    }

    const { data, error } = await supabase
      .from("brands")
      .update(brandInputToUpdate(parsed.data))
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .select(BRAND_SELECT)
      .maybeSingle();

    if (error) {
      console.error("[Brands] Update failed:", error);
      return internalError("Failed to update brand");
    }

    if (!data) {
      return notFound("Brand");
    }

    return successResponse(data as BrandRow);
  },
);

export const DELETE = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { supabase, companyId },
    route: RouteParams,
  ) => {
    const id = await readBrandId(route);
    if (!id) {
      return validationError("Invalid brand id format");
    }

    const { data: existingBrand, error: readError } = await supabase
      .from("brands")
      .select("id")
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (readError) {
      console.error("[Brands] Delete lookup failed:", readError);
      return internalError("Failed to delete brand");
    }

    if (!existingBrand) {
      return notFound("Brand");
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("brands")
      .update({
        deleted_at: now,
        updated_at: now,
      } satisfies BrandUpdate)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("deleted_at", null);

    if (error) {
      console.error("[Brands] Delete failed:", error);
      return internalError("Failed to delete brand");
    }

    return successResponse(null);
  },
);
