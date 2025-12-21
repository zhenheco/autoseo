/**
 * 文章排程 API
 */

import { withCompany, extractPathParams } from "@/lib/api/auth-middleware";
import {
  successResponse,
  notFound,
  validationError,
  internalError,
} from "@/lib/api/response-helpers";

export const POST = withCompany(async (request, { supabase, companyId }) => {
  const { id } = extractPathParams(request);

  if (!id) {
    return notFound("文章");
  }

  const body = await request.json();
  const { scheduled_time, auto_publish } = body;

  if (!scheduled_time) {
    return validationError("排程時間為必填欄位");
  }

  const scheduleDate = new Date(scheduled_time);
  if (scheduleDate <= new Date()) {
    return validationError("排程時間必須是未來的時間");
  }

  // 檢查文章是否存在
  const { data: article, error: articleError } = await supabase
    .from("generated_articles")
    .select("*, article_jobs(*)")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();

  if (articleError || !article) {
    return notFound("文章");
  }

  // 更新文章狀態
  const { error: updateArticleError } = await supabase
    .from("generated_articles")
    .update({
      wordpress_status: "scheduled",
      status: "scheduled",
    })
    .eq("id", id)
    .eq("company_id", companyId);

  if (updateArticleError) {
    console.error("Error scheduling article:", updateArticleError);
    return internalError("設定排程失敗：" + updateArticleError.message);
  }

  // 更新任務排程（如果有關聯任務）
  if (article.article_jobs && article.article_jobs.length > 0) {
    const { error: updateJobError } = await supabase
      .from("article_jobs")
      .update({
        scheduled_publish_at: scheduled_time,
        auto_publish: auto_publish ?? true,
        status: "scheduled",
      })
      .eq("article_id", id);

    if (updateJobError) {
      console.error("Error updating job schedule:", updateJobError);
      return internalError("設定排程失敗：" + updateJobError.message);
    }
  }

  return successResponse({ scheduled_time });
});
