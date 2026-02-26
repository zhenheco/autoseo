#!/usr/bin/env tsx

/**
 * 文章生成任務處理腳本
 *
 * 🔧 優化：
 * - Redis flag 檢查：沒有任務時跳過資料庫查詢
 * - 精簡 select 欄位：減少數據傳輸量
 * - 完整 fallback：Redis 失敗時降級到資料庫查詢
 */

import { createClient } from "@supabase/supabase-js";
import { ParallelOrchestrator } from "../src/lib/agents/orchestrator";
import {
  cacheGet,
  cacheSet,
  isRedisAvailable,
} from "../src/lib/cache/redis-cache";
import { syncCompanyOwnerToBrevo } from "../src/lib/brevo";
import type { Database } from "../src/types/database.types";

const MAX_RETRIES = 2;
const CACHE_KEY_PENDING_ARTICLE = "jobs:pending:article";

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

  // ========== 🔧 優化：先檢查 Redis flag ==========
  let shouldQueryDb = true;
  if (isRedisAvailable()) {
    try {
      const hasPendingJobs = await cacheGet<boolean>(CACHE_KEY_PENDING_ARTICLE);
      if (hasPendingJobs === false) {
        console.log(
          "[Process Jobs] ✅ Redis 顯示沒有待處理任務，跳過資料庫查詢",
        );
        shouldQueryDb = false;
      }
      // hasPendingJobs === null (key 不存在) → 保守處理，查詢資料庫
    } catch {
      console.warn("[Process Jobs] ⚠️ Redis 檢查失敗，fallback 到資料庫查詢");
    }
  }

  // 防呆：每 30 分鐘強制檢查一次資料庫
  if (!shouldQueryDb) {
    const currentMinute = new Date().getMinutes();
    if (currentMinute % 30 === 0) {
      console.log("[Process Jobs] 🔄 定期強制檢查資料庫");
      shouldQueryDb = true;
    }
  }

  if (!shouldQueryDb) {
    return;
  }

  console.log("[Process Jobs] 🔍 查詢待處理任務...");

  const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  // ========== 🔧 優化：精簡 select 欄位 ==========
  // 只查詢 orchestrator.execute() 需要的欄位
  const { data: jobs, error } = await supabase
    .from("article_jobs")
    .select(
      `
      id,
      company_id,
      website_id,
      status,
      keywords,
      metadata,
      started_at,
      created_at
    `,
    )
    .in("status", ["pending", "processing"])
    .or(`started_at.is.null,started_at.lt.${threeMinutesAgo}`)
    .order("created_at", { ascending: true })
    .limit(20); // 最多同時處理 20 個任務

  if (error) {
    console.error("[Process Jobs] ❌ 查詢失敗:", error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("[Process Jobs] ✅ 沒有待處理任務");
    // 更新 Redis flag：確定沒有任務
    if (isRedisAvailable()) {
      await cacheSet(CACHE_KEY_PENDING_ARTICLE, false, 300).catch(() => {});
    }
    return;
  }

  console.log(`[Process Jobs] 🔄 發現 ${jobs.length} 個任務`);
  console.log(`[Process Jobs] ⚡ 使用並行處理模式`);

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
    // 🔧 優化：只需要 id 欄位驗證鎖定
    const { data: locked } = await supabase
      .from("article_jobs")
      .select("id")
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
        writingStyleOverride: metadata?.writing_style as string | undefined,
        keywords: job.keywords || [],
      });

      console.log(`[Process Jobs] ✅ 任務 ${job.id} 處理成功`);

      // 同步用戶到 Brevo（更新文章生成數，觸發分群變更）
      syncCompanyOwnerToBrevo(job.company_id).catch((brevoErr) => {
        // 不影響主流程，僅記錄錯誤
        console.error(`[Process Jobs] ⚠️ Brevo 同步失敗:`, brevoErr);
      });
      console.log(`[Process Jobs] 📧 Brevo 同步已觸發`);

      // 文章生成完成後，檢查是否要自動排程
      if (job.website_id) {
        try {
          const { autoScheduleArticle } = await import(
            "../src/lib/scheduling/auto-schedule"
          );
          const scheduleResult = await autoScheduleArticle(
            supabase,
            job.id,
            job.website_id,
          );

          if (scheduleResult.success) {
            console.log(
              `[Process Jobs] 📅 已自動排程到 ${scheduleResult.scheduledAt}`,
            );
          } else {
            console.log(
              `[Process Jobs] ⏭️  自動排程跳過: ${scheduleResult.error}`,
            );
          }
        } catch (scheduleErr) {
          // 自動排程失敗不影響文章生成結果
          console.error(`[Process Jobs] ⚠️ 自動排程錯誤:`, scheduleErr);
        }
      }

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

  // ========== 🔧 優化：更新 Redis flag ==========
  if (isRedisAvailable()) {
    try {
      // 檢查是否還有其他待處理任務
      const { count: remainingCount } = await supabase
        .from("article_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (remainingCount === 0) {
        // 沒有剩餘任務，設置 flag 為 false
        await cacheSet(CACHE_KEY_PENDING_ARTICLE, false, 300);
        console.log("[Process Jobs] ✅ Redis flag 已設為 false（無剩餘任務）");
      } else {
        // 還有任務，刷新 TTL
        await cacheSet(CACHE_KEY_PENDING_ARTICLE, true, 300);
        console.log(
          `[Process Jobs] ℹ️ 還有 ${remainingCount} 個待處理任務，刷新 Redis flag`,
        );
      }
    } catch {
      // Redis 更新失敗不影響主流程
      console.warn("[Process Jobs] ⚠️ Redis flag 更新失敗，忽略");
    }
  }

  console.log("[Process Jobs] 🎉 所有任務處理完成");
}

main().catch((err) => {
  console.error("[Process Jobs] ❌ Fatal error:", err);
  process.exit(1);
});
