/**
 * 取消文章生成任務 API
 *
 * 篇數制計費邏輯：
 * - 文章只有在「完成」時才會被扣篇
 * - 取消任務時只需釋放預扣，不會扣篇
 */

import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";
import { ArticleQuotaService } from "@/lib/billing/article-quota-service";

export const POST = withCompany(async (request, { supabase, companyId }) => {
  const { id: jobId } = extractPathParams(request);

  if (!jobId) {
    return notFound("任務");
  }

  // 查詢任務狀態
  const { data: job, error: jobError } = await supabase
    .from("article_jobs")
    .select("id, status, progress, company_id")
    .eq("id", jobId)
    .eq("company_id", companyId)
    .single();

  if (jobError || !job) {
    return notFound("任務");
  }

  // 檢查狀態（只能取消 pending 或 processing）
  if (job.status !== "pending" && job.status !== "processing") {
    return validationError(`無法取消 ${job.status} 狀態的任務`);
  }

  const progress = job.progress || 0;

  // 更新任務狀態為 cancelled
  const { error: updateError } = await supabase
    .from("article_jobs")
    .update({
      status: "cancelled",
      error_message: `用戶取消生成（進度 ${progress}%）`,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (updateError) {
    console.error("Error updating job status:", updateError);
    return internalError("更新狀態失敗");
  }

  // 釋放預扣（篇數制：文章未完成就不扣篇）
  const quotaService = new ArticleQuotaService(supabase);
  await quotaService.releaseReservation(jobId);

  return successResponse(null, "任務已取消，額度已退還");
});
