#!/usr/bin/env tsx

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

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

  console.log("[Monitor] 🔍 開始監控文章生成任務");

  const now = new Date();
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

  const stats = {
    totalProcessing: 0,
    timedOut: 0,
    stuck: 0,
    retried: 0,
    completedButNotSaved: 0,
    errors: [] as string[],
  };

  // 查詢所有處理中的任務
  const { data: processingJobs, error: jobsError } = await supabase
    .from("article_jobs")
    .select("*")
    .eq("status", "processing");

  if (jobsError) {
    console.error("[Monitor] ❌ 查詢任務失敗:", jobsError);
    process.exit(1);
  }

  stats.totalProcessing = processingJobs?.length || 0;
  console.log(`[Monitor] 📊 發現 ${stats.totalProcessing} 個處理中任務`);

  // 處理每個任務
  for (const job of processingJobs || []) {
    try {
      const startedAt = new Date(job.started_at || job.created_at);
      const lastUpdated = new Date(job.updated_at);
      const metadata = (job.metadata as Record<string, unknown>) || {};

      // 檢查是否超時（> 30 分鐘）
      if (startedAt < thirtyMinutesAgo) {
        console.log(`[Monitor] ⏰ 任務 ${job.id} 超時，執行時間超過 30 分鐘`);
        stats.timedOut++;

        const retryCount = (metadata.retry_count as number) || 0;
        if (retryCount < 1) {
          // 嘗試重新生成（最多 1 次）
          console.log(
            `[Monitor] 🔄 重試任務 ${job.id}（第 ${retryCount + 1} 次）`,
          );

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

          stats.retried++;
        } else {
          // 標記為失敗
          console.log(
            `[Monitor] ❌ 標記任務 ${job.id} 為失敗（已重試 ${retryCount} 次）`,
          );

          await supabase
            .from("article_jobs")
            .update({
              status: "failed",
              error_message: "任務執行超時（超過 30 分鐘）",
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        }
        continue;
      }

      // 檢查是否卡住（某階段 > 10 分鐘）
      if (lastUpdated < tenMinutesAgo && metadata.current_phase) {
        console.log(
          `[Monitor] ⚠️  任務 ${job.id} 可能卡在階段: ${metadata.current_phase}`,
        );
        stats.stuck++;
      }
    } catch (error) {
      const err = error as Error;
      console.error(`[Monitor] ❌ 處理任務 ${job.id} 時發生錯誤:`, err);
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
        console.log(
          `[Monitor] ⚠️  任務 ${job.id} 已完成但未儲存，需要手動處理`,
        );
        stats.completedButNotSaved++;
      }
    }
  }

  // 輸出執行摘要
  console.log("\n[Monitor] 📈 監控摘要:");
  console.log(`  - 處理中任務: ${stats.totalProcessing}`);
  console.log(`  - 超時任務: ${stats.timedOut}`);
  console.log(`  - 卡住任務: ${stats.stuck}`);
  console.log(`  - 已重試: ${stats.retried}`);
  console.log(`  - 未儲存: ${stats.completedButNotSaved}`);

  if (stats.errors.length > 0) {
    console.log(`  - 錯誤: ${stats.errors.length}`);
    stats.errors.forEach((e) => console.log(`    - ${e}`));
  }

  console.log("\n[Monitor] ✅ 監控完成");
}

main().catch((err) => {
  console.error("[Monitor] ❌ Fatal error:", err);
  process.exit(1);
});
