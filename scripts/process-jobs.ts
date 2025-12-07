#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js";
import { ParallelOrchestrator } from "../src/lib/agents/orchestrator";
import type { Database } from "../src/types/database.types";

const MAX_RETRIES = 2;

/**
 * 判斷錯誤是否可重試
 * 不可重試的錯誤包括：認證錯誤、無效請求等
 */
function isRetryableJobError(errorMessage: string): boolean {
  const nonRetryablePatterns = [
    "Invalid API key",
    "Unauthorized",
    "invalid_request",
    "company_id is required",
    "website_id is required",
  ];
  return !nonRetryablePatterns.some((p) =>
    errorMessage.toLowerCase().includes(p.toLowerCase()),
  );
}

async function main() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  console.log("[Process Jobs] 🔍 查詢待處理任務...");

  // 查詢待處理任務：
  // 1. status 為 pending 或 processing
  // 2. started_at 為 null（未開始）或超過 3 分鐘（卡住的任務）
  const { data: jobs, error } = await supabase
    .from("article_jobs")
    .select("*")
    .in("status", ["pending", "processing"])
    .or(
      `started_at.is.null,started_at.lt.${new Date(Date.now() - 3 * 60 * 1000).toISOString()}`,
    )
    .order("created_at", { ascending: true })
    .limit(20); // 最多同時處理 20 個任務

  if (error) {
    console.error("[Process Jobs] ❌ 查詢失敗:", error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("[Process Jobs] ✅ 沒有待處理任務");
    return;
  }

  console.log(`[Process Jobs] 🔄 發現 ${jobs.length} 個任務`);
  console.log(`[Process Jobs] ⚡ 使用並行處理模式`);

  // 樂觀鎖定時間戳（與查詢條件一致）
  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  // 並行處理所有任務
  const processPromises = jobs.map(async (job) => {
    console.log(`[Process Jobs] 🔒 嘗試鎖定任務 ${job.id}`);

    // 生成唯一的鎖定時間戳
    const lockTimestamp = new Date().toISOString();

    // Step 1: 嘗試更新（使用樂觀鎖定條件）
    // 注意：不使用 .select()，因為 Supabase 會重新套用 .or() 條件導致空結果
    const { error: lockError } = await supabase
      .from("article_jobs")
      .update({
        status: "processing",
        started_at: lockTimestamp,
      })
      .eq("id", job.id)
      .in("status", ["pending", "processing"])
      .or(`started_at.is.null,started_at.lt.${threeMinutesAgo}`);

    if (lockError) {
      console.log(
        `[Process Jobs] ❌ 鎖定任務失敗 ${job.id}: ${lockError.message}`,
      );
      return { success: false, jobId: job.id };
    }

    // Step 2: 驗證是否成功取得鎖定（檢查 started_at 是否為我們設定的值）
    const { data: locked } = await supabase
      .from("article_jobs")
      .select("*")
      .eq("id", job.id)
      .eq("started_at", lockTimestamp)
      .single();

    if (!locked) {
      console.log(`[Process Jobs] ⏭️  任務 ${job.id} 已被其他程序處理，跳過`);
      return { success: false, jobId: job.id };
    }

    console.log(`[Process Jobs] ✅ 成功鎖定任務 ${job.id}`);

    try {
      const orchestrator = new ParallelOrchestrator(supabase);
      const metadata = job.metadata as Record<string, unknown> | null;
      const title =
        (metadata?.title as string) || job.keywords?.[0] || "Untitled";

      console.log(`[Process Jobs] 🚀 開始處理任務 ${job.id} - ${title}`);

      await orchestrator.execute({
        articleJobId: job.id,
        companyId: job.company_id,
        websiteId: job.website_id,
        title: title,
        targetLanguage: metadata?.targetLanguage as string | undefined,
        language: metadata?.language as string | undefined,
        region: metadata?.region as string | undefined,
        industry: metadata?.industry as string | null | undefined,
        wordCount:
          typeof metadata?.wordCount === "string"
            ? parseInt(metadata.wordCount)
            : (metadata?.wordCount as number | undefined),
        imageCount:
          typeof metadata?.imageCount === "string"
            ? parseInt(metadata.imageCount)
            : (metadata?.imageCount as number | undefined),
      });

      console.log(`[Process Jobs] ✅ 任務 ${job.id} 處理成功`);
      return { success: true, jobId: job.id };
    } catch (err) {
      console.error(`[Process Jobs] ❌ 任務 ${job.id} 失敗:`, err);

      const currentMetadata = (job.metadata as Record<string, unknown>) || {};
      const retryCount = (currentMetadata.retry_count as number) || 0;
      const errorMessage = err instanceof Error ? err.message : String(err);

      // 檢查是否可重試且未超過最大重試次數
      if (isRetryableJobError(errorMessage) && retryCount < MAX_RETRIES) {
        console.log(
          `[Process Jobs] 🔄 排程重試 ${retryCount + 1}/${MAX_RETRIES} - 任務 ${job.id}`,
        );
        await supabase
          .from("article_jobs")
          .update({
            status: "pending",
            started_at: null,
            metadata: {
              ...currentMetadata,
              retry_count: retryCount + 1,
              last_error: errorMessage,
              last_retry_at: new Date().toISOString(),
            },
          })
          .eq("id", job.id);
      } else {
        // 不可重試或已達最大重試次數，標記為失敗
        const reason = !isRetryableJobError(errorMessage)
          ? "不可重試的錯誤"
          : `已重試 ${retryCount} 次`;
        console.log(`[Process Jobs] ❌ 任務 ${job.id} 標記為失敗（${reason}）`);
        await supabase
          .from("article_jobs")
          .update({
            status: "failed",
            metadata: {
              ...currentMetadata,
              error: errorMessage,
              failed_at: new Date().toISOString(),
              retry_count: retryCount,
            },
          })
          .eq("id", job.id);
      }

      return { success: false, jobId: job.id };
    }
  });

  // 等待所有任務完成
  const results = await Promise.all(processPromises);
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  console.log(
    `[Process Jobs] 📊 處理結果：${successCount} 成功，${failedCount} 失敗`,
  );
  results.forEach((result) => {
    console.log(`  - ${result.jobId}: ${result.success ? "✅" : "❌"}`);
  });

  console.log("[Process Jobs] 🎉 所有任務處理完成");
}

main().catch((err) => {
  console.error("[Process Jobs] ❌ Fatal error:", err);
  process.exit(1);
});
