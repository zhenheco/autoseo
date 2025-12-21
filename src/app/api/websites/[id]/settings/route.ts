/**
 * 網站設定 API
 */

import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import { successResponse, notFound } from "@/lib/api/response-helpers";

export const GET = withCompany(async (request, { supabase, companyId }) => {
  const { id: websiteId } = extractPathParams(request);

  if (!websiteId) {
    return notFound("網站");
  }

  const { data: website, error } = await supabase
    .from("website_configs")
    .select("id, industry, region, language")
    .eq("id", websiteId)
    .eq("company_id", companyId)
    .single();

  if (error || !website) {
    return notFound("網站");
  }

  return successResponse({
    industry: website.industry || "",
    region: website.region || "",
    language: website.language || "",
  });
});
