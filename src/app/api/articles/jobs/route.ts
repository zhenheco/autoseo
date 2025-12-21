/**
 * 文章任務列表 API
 */

import { withCompany } from "@/lib/api/auth-middleware";
import { successResponse, internalError } from "@/lib/api/response-helpers";

export const GET = withCompany(async (request, { supabase, companyId }) => {
  const { data: jobs, error } = await supabase
    .from("article_jobs")
    .select("id, keywords, status, created_at, metadata")
    .eq("company_id", companyId)
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch jobs:", error);
    return internalError("Failed to fetch jobs");
  }

  return successResponse({ jobs: jobs || [] });
});
