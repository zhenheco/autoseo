import type { SupabaseClient } from "@supabase/supabase-js";

export interface BrandVoiceFormValue {
  brand_name?: string;
  tone_of_voice?: string;
  target_audience?: string;
  writing_style?: string;
}

interface BrandRow {
  id: string;
  name: string;
  voice_tone: string | null;
  target_audience: unknown;
  brand_guidelines: string | null;
}

function targetAudienceToString(targetAudience: unknown): string {
  if (!targetAudience) return "";
  if (typeof targetAudience === "string") return targetAudience;
  if (typeof targetAudience === "object" && !Array.isArray(targetAudience)) {
    const value = targetAudience as {
      description?: unknown;
      audience?: unknown;
    };
    if (typeof value.description === "string") return value.description;
    if (typeof value.audience === "string") return value.audience;
  }

  return "";
}

export function brandRowToBrandVoice(
  brand: BrandRow | null,
): BrandVoiceFormValue | null {
  if (!brand) return null;

  return {
    brand_name: brand.name,
    tone_of_voice: brand.voice_tone || undefined,
    target_audience: targetAudienceToString(brand.target_audience),
    writing_style: brand.brand_guidelines || undefined,
  };
}

export function brandVoiceToBrandUpdate(
  brandVoice: BrandVoiceFormValue,
  fallbackName: string,
) {
  const targetAudience = brandVoice.target_audience?.trim();

  return {
    name: brandVoice.brand_name?.trim() || fallbackName,
    voice_tone: brandVoice.tone_of_voice?.trim() || null,
    target_audience: targetAudience
      ? {
          description: targetAudience,
        }
      : null,
    brand_guidelines: brandVoice.writing_style?.trim() || null,
  };
}

export async function getDefaultBrandIdForCompany(
  supabase: SupabaseClient,
  companyId: string,
  fallbackName: string,
): Promise<string | null> {
  const { data: existingBrand } = await supabase
    .from("brands")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_default", true)
    .maybeSingle();

  if (existingBrand?.id) {
    return existingBrand.id;
  }

  const { data: createdBrand, error } = await supabase
    .from("brands")
    .insert({
      company_id: companyId,
      name: fallbackName,
      is_default: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[Brand] Failed to create default brand:", error);
    return null;
  }

  return createdBrand.id;
}

export async function getWebsiteBrandVoice(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<BrandVoiceFormValue | null> {
  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("brand_id, company_id, website_name")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) return null;

  const brandId =
    website.brand_id ||
    (website.company_id
      ? await getDefaultBrandIdForCompany(
          supabase,
          website.company_id,
          website.website_name || "Default Brand",
        )
      : null);

  if (!brandId) return null;

  const { data: brand } = await supabase
    .from("brands")
    .select("id, name, voice_tone, target_audience, brand_guidelines")
    .eq("id", brandId)
    .single();

  return brandRowToBrandVoice((brand as BrandRow | null) ?? null);
}

export async function updateBrandVoiceForWebsite(
  supabase: SupabaseClient,
  websiteId: string,
  brandVoice: BrandVoiceFormValue,
): Promise<{ error: Error | null }> {
  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("brand_id, company_id, website_name")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return {
      error: websiteError ?? new Error("Website not found"),
    };
  }

  if (!website.company_id) {
    return {
      error: new Error("Website has no company and cannot be assigned a brand"),
    };
  }

  const brandId =
    website.brand_id ||
    (await getDefaultBrandIdForCompany(
      supabase,
      website.company_id,
      website.website_name || "Default Brand",
    ));

  if (!brandId) {
    return {
      error: new Error("Default brand could not be created"),
    };
  }

  if (!website.brand_id) {
    const { error: websiteUpdateError } = await supabase
      .from("website_configs")
      .update({ brand_id: brandId })
      .eq("id", websiteId);

    if (websiteUpdateError) {
      return { error: websiteUpdateError };
    }
  }

  const { error } = await supabase
    .from("brands")
    .update(brandVoiceToBrandUpdate(brandVoice, website.website_name))
    .eq("id", brandId);

  return { error: error as Error | null };
}
