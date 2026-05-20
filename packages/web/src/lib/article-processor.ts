import { createAdminClient } from "@/lib/supabase/server";
import { ParallelOrchestrator } from "@/lib/agents/orchestrator";
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_CONCURRENT_JOBS = 100;
const MAX_RETRY_COUNT = 3;
const RETRY_DELAYS_MINUTES = [5, 30, 120];

export async function processArticleJob(jobId: string): Promise<void> {
  const supabase = createAdminClient();

  const processingCount = await getProcessingJobCount(supabase);

  if (processingCount >= MAX_CONCURRENT_JOBS) {
    console.log(
      `[ArticleProcessor] 已達並行上限 (${processingCount}/${MAX_CONCURRENT_JOBS})，任務 ${jobId} 保持 pending`,
    );
    return;
  }

  const { data: job, error: fetchError } = await supabase
    .from("article_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("status", "pending")
    .single();

  if (fetchError || !job) {
    console.log(`[ArticleProcessor] 任務 ${jobId} 不存在或非 pending 狀態`);
    return;
  }

  const { data: locked, error: lockError } = await supabase
    .from("article_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select();

  if (lockError || !locked || locked.length === 0) {
    console.log(
      `[ArticleProcessor] 任務 ${jobId} 無法鎖定（可能已被其他程序處理）`,
    );
    return;
  }

  console.log(`[ArticleProcessor] 開始處理任務 ${jobId}`);

  try {
    const orchestrator = new ParallelOrchestrator(supabase);
    const metadata = job.metadata as Record<string, unknown> | null;
    const title =
      (metadata?.title as string) || job.keywords?.[0] || "Untitled";

    await orchestrator.execute({
      articleJobId: job.id,
      companyId: job.company_id,
      websiteId: job.website_id,
      title: title,
      targetLanguage: metadata?.targetLanguage as string | undefined,
      wordCount:
        typeof metadata?.wordCount === "string"
          ? parseInt(metadata.wordCount)
          : (metadata?.wordCount as number | undefined),
      imageCount:
        typeof metadata?.imageCount === "string"
          ? parseInt(metadata.imageCount)
          : (metadata?.imageCount as number | undefined),
    });

    console.log(`[ArticleProcessor] 任務 ${jobId} 處理成功`);

    await triggerNextPendingJob(supabase);
  } catch (error) {
    console.error(`[ArticleProcessor] 任務 ${jobId} 失敗:`, error);
    await handleJobFailure(supabase, job, error as Error);

    await triggerNextPendingJob(supabase);
  }
}

async function getProcessingJobCount(
  supabase: SupabaseClient,
): Promise<number> {
  const { count, error } = await supabase
    .from("article_jobs")
    .select("*", { count: "exact", head: true })
    .eq("status", "processing");

  if (error) {
    console.error("[ArticleProcessor] 查詢處理中任務數量失敗:", error);
    return MAX_CONCURRENT_JOBS;
  }

  return count || 0;
}

async function handleJobFailure(
  supabase: SupabaseClient,
  job: { id: string; retry_count?: number | null; metadata?: unknown },
  error: Error,
): Promise<void> {
  const currentRetryCount = job.retry_count || 0;

  if (currentRetryCount < MAX_RETRY_COUNT) {
    const nextRetryMinutes = RETRY_DELAYS_MINUTES[currentRetryCount] || 120;
    const nextRetryAt = new Date(Date.now() + nextRetryMinutes * 60 * 1000);

    await supabase
      .from("article_jobs")
      .update({
        status: "pending",
        retry_count: currentRetryCount + 1,
        next_retry_at: nextRetryAt.toISOString(),
        started_at: null,
        metadata: {
          ...((job.metadata as Record<string, unknown>) || {}),
          last_error: error.message,
          last_failed_at: new Date().toISOString(),
        },
      })
      .eq("id", job.id);

    console.log(
      `[ArticleProcessor] 任務 ${job.id} 排程重試 #${currentRetryCount + 1}，${nextRetryMinutes} 分鐘後`,
    );
  } else {
    await supabase
      .from("article_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...((job.metadata as Record<string, unknown>) || {}),
          error: error.message,
          failed_at: new Date().toISOString(),
          total_retries: currentRetryCount,
        },
      })
      .eq("id", job.id);

    console.log(`[ArticleProcessor] 任務 ${job.id} 已達重試上限，標記為失敗`);
  }
}

async function triggerNextPendingJob(supabase: SupabaseClient): Promise<void> {
  const processingCount = await getProcessingJobCount(supabase);

  if (processingCount >= MAX_CONCURRENT_JOBS) {
    return;
  }

  const now = new Date().toISOString();
  const { data: nextJob, error } = await supabase
    .from("article_jobs")
    .select("id")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !nextJob) {
    return;
  }

  console.log(`[ArticleProcessor] 觸發下一個待處理任務: ${nextJob.id}`);

  processArticleJob(nextJob.id).catch((err) => {
    console.error(`[ArticleProcessor] 觸發任務 ${nextJob.id} 失敗:`, err);
  });
}

export async function processPendingJobs(): Promise<{
  triggered: number;
  skipped: number;
}> {
  const supabase = createAdminClient();
  const processingCount = await getProcessingJobCount(supabase);
  const availableSlots = MAX_CONCURRENT_JOBS - processingCount;

  if (availableSlots <= 0) {
    console.log(
      `[ArticleProcessor] 已達並行上限 (${processingCount}/${MAX_CONCURRENT_JOBS})`,
    );
    return { triggered: 0, skipped: 0 };
  }

  const now = new Date().toISOString();
  const { data: pendingJobs, error } = await supabase
    .from("article_jobs")
    .select("id")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(availableSlots);

  if (error || !pendingJobs || pendingJobs.length === 0) {
    console.log("[ArticleProcessor] 沒有待處理任務");
    return { triggered: 0, skipped: 0 };
  }

  console.log(
    `[ArticleProcessor] 發現 ${pendingJobs.length} 個待處理任務，可用槽位: ${availableSlots}`,
  );

  const promises = pendingJobs.map((job) =>
    processArticleJob(job.id).catch((err) => {
      console.error(`[ArticleProcessor] 處理任務 ${job.id} 時發生錯誤:`, err);
    }),
  );

  Promise.all(promises);

  return { triggered: pendingJobs.length, skipped: 0 };
}
