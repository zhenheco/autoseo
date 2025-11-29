import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ParallelOrchestrator } from "@/lib/agents/orchestrator";
import { ArticleStorageService } from "@/lib/services/article-storage";
import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database.types";

type ArticleJob = Database["public"]["Tables"]["article_jobs"]["Row"];

/**
 * 監控文章生成任務
 * - 檢查超時任務（> 30 分鐘）
 * - 檢查卡住的任務（某階段 > 10 分鐘）
 * - 檢查已完成但未儲存的任務
 * - 自動重試失敗的任務
 */
export async function POST(request: NextRequest) {
  // 驗證 Authorization header
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Monitor] 開始監控文章生成任務");

  try {
    const supabase = createAdminClient();
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    // 查詢所有處理中的任務
    const { data: processingJobs, error: jobsError } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("status", "processing");

    if (jobsError) {
      console.error("[Monitor] 查詢任務失敗:", jobsError);
      return NextResponse.json(
        { error: "Failed to query jobs", details: jobsError.message },
        { status: 500 },
      );
    }

    const stats = {
      totalProcessing: processingJobs?.length || 0,
      timedOut: 0,
      stuck: 0,
      retried: 0,
      completedButNotSaved: 0,
      errors: [] as string[],
    };

    // 處理每個任務
    for (const job of processingJobs || []) {
      try {
        const startedAt = new Date(job.started_at || job.created_at);
        const lastUpdated = new Date(job.updated_at);
        const metadata = job.metadata || {};

        // 檢查是否超時（> 30 分鐘）
        if (startedAt < thirtyMinutesAgo) {
          console.log(`[Monitor] 任務 ${job.id} 超時，執行時間超過 30 分鐘`);
          stats.timedOut++;

          const retryCount = metadata.retry_count || 0;
          if (retryCount < 1) {
            // 嘗試重新生成（最多 1 次）
            console.log(
              `[Monitor] 重試任務 ${job.id}（第 ${retryCount + 1} 次）`,
            );
            await retryJob(job, supabase);
            stats.retried++;
          } else {
            // 標記為失敗
            console.log(
              `[Monitor] 標記任務 ${job.id} 為失敗（已重試 ${retryCount} 次）`,
            );
            await markJobAsFailed(
              job,
              "任務執行超時（超過 30 分鐘）",
              supabase,
            );
          }
          continue;
        }

        // 檢查是否卡住（某階段 > 10 分鐘）
        if (lastUpdated < tenMinutesAgo && metadata.current_phase) {
          console.log(
            `[Monitor] 任務 ${job.id} 可能卡在階段: ${metadata.current_phase}`,
          );
          stats.stuck++;

          // 嘗試從當前階段恢復
          if (metadata.current_phase !== "completed") {
            console.log(
              `[Monitor] 嘗試恢復任務 ${job.id} 從階段: ${metadata.current_phase}`,
            );
            // 這裡可以實作恢復邏輯
            // await resumeJob(job, supabase);
          }
        }
      } catch (error) {
        const err = error as Error;
        console.error(`[Monitor] 處理任務 ${job.id} 時發生錯誤:`, err);
        stats.errors.push(`Job ${job.id}: ${err.message}`);
      }
    }

    // 檢查已完成但未儲存到 generated_articles 的任務
    const { data: completedJobs, error: completedError } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("status", "completed")
      .gte("updated_at", thirtyMinutesAgo.toISOString());

    if (!completedError && completedJobs) {
      for (const job of completedJobs) {
        // 檢查是否已儲存到 generated_articles
        const { data: article } = await supabase
          .from("generated_articles")
          .select("id")
          .eq("article_job_id", job.id)
          .single();

        if (!article && job.result) {
          console.log(`[Monitor] 任務 ${job.id} 已完成但未儲存，嘗試重新儲存`);
          stats.completedButNotSaved++;

          try {
            // 嘗試重新儲存
            const storageService = new ArticleStorageService(supabase);
            await storageService.saveArticle({
              articleJobId: job.id,
              result: job.result,
              websiteId: job.website_id,
              companyId: job.company_id,
              userId: job.user_id,
            });
            console.log(`[Monitor] 成功儲存任務 ${job.id} 的文章`);
          } catch (error) {
            const err = error as Error;
            console.error(`[Monitor] 儲存任務 ${job.id} 失敗:`, err);
            stats.errors.push(`Save ${job.id}: ${err.message}`);
          }
        }
      }
    }

    // 返回執行摘要
    const summary = {
      timestamp: now.toISOString(),
      stats,
      message: `監控完成：${stats.totalProcessing} 個處理中任務，${stats.timedOut} 個超時，${stats.stuck} 個卡住，${stats.retried} 個重試，${stats.completedButNotSaved} 個重新儲存`,
    };

    console.log("[Monitor] 監控完成:", summary);

    return NextResponse.json(summary);
  } catch (error) {
    const err = error as Error;
    console.error("[Monitor] 監控失敗:", err);
    return NextResponse.json(
      { error: "Monitoring failed", details: err.message },
      { status: 500 },
    );
  }
}

/**
 * 重試任務
 */
async function retryJob(
  job: ArticleJob,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  const metadata = (job.metadata || {}) as Record<string, unknown>;
  const retryCount =
    typeof metadata.retry_count === "number" ? metadata.retry_count : 0;

  // 更新重試次數
  await supabase
    .from("article_jobs")
    .update({
      status: "pending",
      metadata: {
        ...metadata,
        retry_count: retryCount + 1,
        retry_reason: "Timeout after 30 minutes",
        last_retry_at: new Date().toISOString(),
      },
      started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  // 觸發重新生成
  // 這裡可以呼叫 orchestrator 或發送到佇列
  if (!job.website_id || !job.company_id || !job.user_id) {
    console.error(`[Monitor] 任務 ${job.id} 缺少必要欄位`);
    return;
  }

  try {
    const orchestrator = new ParallelOrchestrator(supabase);
    await orchestrator.execute({
      articleJobId: job.id,
      websiteId: job.website_id,
      companyId: job.company_id,
      userId: job.user_id,
      title: job.keywords?.[0] || "Untitled",
    });
  } catch (error) {
    console.error(`[Monitor] 重試任務 ${job.id} 失敗:`, error);
  }
}

/**
 * 標記任務為失敗
 */
async function markJobAsFailed(
  job: ArticleJob,
  reason: string,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  await supabase
    .from("article_jobs")
    .update({
      status: "failed",
      error_message: reason,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);
}
