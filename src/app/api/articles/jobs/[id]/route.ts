/**
 * 文章任務刪除 API
 */

import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  internalError,
} from "@/lib/api/response-helpers";

/**
 * DELETE /api/articles/jobs/[id]
 * 刪除單個 article_job
 */
export const DELETE = withCompany(async (request, { supabase, companyId }) => {
  const { id } = extractPathParams(request);

  if (!id) {
    return notFound("任務");
  }

  const { error } = await supabase
    .from("article_jobs")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);

  if (error) {
    console.error("Failed to delete job:", error);
    return internalError("Failed to delete job");
  }

  return successResponse(null, "任務已刪除");
});
