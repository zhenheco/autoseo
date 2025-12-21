/**
 * 網站列表 API
 */

import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, internalError } from "@/lib/api/response-helpers";

export const GET = withCompany(async (request, { supabase, companyId }) => {
  const { data: websites, error } = await supabase
    .from("website_configs")
    .select("id, website_name, base_url, slug_prefix")
    .eq("company_id", companyId)
    .order("website_name");

  if (error) {
    console.error("獲取網站列表錯誤:", error);
    return internalError("獲取網站列表失敗");
  }

  return successResponse(websites || []);
});
