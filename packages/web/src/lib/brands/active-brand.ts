import { getUser, getUserPrimaryCompany } from "@shared/auth";
import { createClient } from "@shared/supabase";
import type { Database } from "@/types/database.types";
import { ACTIVE_BRAND_COOKIE } from "./constants";

export type Brand = Database["public"]["Tables"]["brands"]["Row"];

export function resolveActiveBrandFromCandidates(
  req: Request,
  brands: Brand[],
): Brand | null {
  if (brands.length === 0) return null;

  const url = new URL(req.url);
  const queryBrandId = url.searchParams.get("brand");
  const cookieBrandId = readCookie(
    req.headers.get("cookie") ?? req.headers.get("Cookie"),
    ACTIVE_BRAND_COOKIE,
  );

  return (
    brands.find((brand) => brand.id === queryBrandId) ??
    brands.find((brand) => brand.id === cookieBrandId) ??
    brands[0] ??
    null
  );
}

export async function resolveActiveBrand(req: Request): Promise<Brand | null> {
  const user = await getUser();
  if (!user) return null;

  const company = await getUserPrimaryCompany(user.id);
  if (!company) return null;

  const brands = await loadActiveBrands(company.id);
  return resolveActiveBrandFromCandidates(req, brands);
}

async function loadActiveBrands(companyId: string): Promise<Brand[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .select(
      "id, company_id, name, voice_tone, target_audience, value_props, brand_guidelines, logo_url, primary_color, secondary_color, is_default, created_at, updated_at, deleted_at",
    )
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[Brands] Failed to resolve active brand:", error);
    return [];
  }

  return Array.isArray(data) ? (data as Brand[]) : [];
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${escapedName}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}
