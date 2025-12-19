#!/usr/bin/env tsx

/**
 * 每日 Billing 審計腳本
 *
 * 功能：
 * 1. 比對 completed jobs vs 扣款記錄（支援新舊兩種計費系統）
 *    - 舊系統：token_deduction_records（Token 制）
 *    - 新系統：article_usage_logs（篇數制）
 * 2. 檢測 metadata.billing_status 為 "failed" 的任務
 * 3. 認可 "success" 和 "reconciled" 為有效扣款狀態
 * 4. 輸出未扣款任務清單
 *
 * 用法：
 *   pnpm tsx scripts/billing-audit.ts
 *   pnpm tsx scripts/billing-audit.ts --days 7  # 檢查過去 7 天
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

async function main() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 解析參數
  const daysArg = process.argv.find((arg) => arg.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1]) : 1;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[Billing Audit] 🔍 檢查過去 ${days} 天的任務...`);
  console.log(`[Billing Audit] 📅 起始時間: ${since}`);

  // 1. 獲取已完成的 jobs
  const { data: completedJobs, error: jobsError } = await supabase
    .from("article_jobs")
    .select("id, company_id, status, metadata, created_at")
    .in("status", ["completed", "scheduled", "published"])
    .gte("created_at", since);

  if (jobsError) {
    console.error("[Billing Audit] ❌ 查詢 jobs 失敗:", jobsError);
    process.exit(1);
  }

  console.log(
    `[Billing Audit] 📊 找到 ${completedJobs?.length || 0} 個已完成任務`,
  );

  // 2a. 獲取舊系統扣款記錄（Token 制）
  // 注意：idempotency_key 存儲的是 article_job_id（見 migration 20251114000000）
  const { data: tokenDeductions, error: tokenDeductionsError } = await supabase
    .from("token_deduction_records")
    .select("idempotency_key")
    .gte("created_at", since);

  if (tokenDeductionsError) {
    console.error(
      "[Billing Audit] ❌ 查詢 token_deduction_records 失敗:",
      tokenDeductionsError,
    );
    process.exit(1);
  }

  // 2b. 獲取新系統扣款記錄（篇數制）
  // article_usage_logs 使用 article_job_id 欄位
  const { data: articleDeductions, error: articleDeductionsError } = (await (
    supabase.from("article_usage_logs" as "companies") as unknown as {
      select: (columns: string) => {
        gte: (
          column: string,
          value: string,
        ) => Promise<{
          data: Array<{ article_job_id: string }> | null;
          error: { message: string } | null;
        }>;
      };
    }
  )
    .select("article_job_id")
    .gte("created_at", since)) as {
    data: Array<{ article_job_id: string }> | null;
    error: { message: string } | null;
  };

  if (articleDeductionsError) {
    // article_usage_logs 可能不存在（舊版本），不視為錯誤
    console.log(
      "[Billing Audit] ℹ️ article_usage_logs 查詢失敗（可能是舊版本）:",
      articleDeductionsError.message,
    );
  }

  const tokenDeductionCount = tokenDeductions?.length || 0;
  const articleDeductionCount = articleDeductions?.length || 0;
  console.log(
    `[Billing Audit] 📊 找到 ${tokenDeductionCount} 條 Token 扣款記錄`,
  );
  console.log(
    `[Billing Audit] 📊 找到 ${articleDeductionCount} 條篇數扣款記錄`,
  );

  // 3. 找出未扣款的任務（合併兩種系統的記錄）
  const deductedJobIds = new Set([
    ...(tokenDeductions?.map((d) => d.idempotency_key) || []),
    ...(articleDeductions?.map((d) => d.article_job_id) || []),
  ]);

  // 有效的 billing_status 值（已扣款或已補扣）
  const validBillingStatuses = new Set(["success", "reconciled"]);

  const unchargedJobs = (completedJobs || []).filter((job) => {
    const metadata = job.metadata as Record<string, unknown> | null;

    // 如果 billing_status 為 success 或 reconciled，視為已扣款
    if (validBillingStatuses.has(metadata?.billing_status as string)) {
      return false;
    }

    // 如果有扣款記錄，視為已扣款
    if (deductedJobIds.has(job.id)) {
      return false;
    }

    return true;
  });

  // 4. 找出 billing_status = "failed" 的任務
  const billingFailedJobs = (completedJobs || []).filter((job) => {
    const metadata = job.metadata as Record<string, unknown> | null;
    return metadata?.billing_status === "failed";
  });

  // 5. 輸出結果
  console.log("\n" + "=".repeat(60));
  console.log("[Billing Audit] 📋 審計結果");
  console.log("=".repeat(60));

  if (unchargedJobs.length === 0 && billingFailedJobs.length === 0) {
    console.log("\n✅ 所有任務都已正常扣款，沒有異常！\n");
    process.exit(0);
  }

  if (unchargedJobs.length > 0) {
    console.log(`\n🚨 發現 ${unchargedJobs.length} 個未扣款任務：`);
    unchargedJobs.forEach((job) => {
      const metadata = job.metadata as Record<string, unknown> | null;
      console.log(`  - Job ID: ${job.id}`);
      console.log(`    Company: ${job.company_id}`);
      console.log(`    Status: ${job.status}`);
      console.log(
        `    Billing Status: ${metadata?.billing_status || "未記錄"}`,
      );
      console.log(`    Created: ${job.created_at}`);
      console.log("");
    });
  }

  if (billingFailedJobs.length > 0) {
    console.log(`\n⚠️ 發現 ${billingFailedJobs.length} 個扣款失敗的任務：`);
    billingFailedJobs.forEach((job) => {
      const metadata = job.metadata as Record<string, unknown> | null;
      console.log(`  - Job ID: ${job.id}`);
      console.log(`    Company: ${job.company_id}`);
      console.log(`    Error: ${metadata?.billing_error || "未知錯誤"}`);
      console.log(`    Notice: ${metadata?.billing_error_notice || ""}`);
      console.log(`    Failed At: ${metadata?.billing_failed_at || ""}`);
      console.log("");
    });
  }

  // 6. 統計摘要
  const totalDeductions = tokenDeductionCount + articleDeductionCount;
  const chargedByStatus = (completedJobs || []).filter((job) => {
    const metadata = job.metadata as Record<string, unknown> | null;
    return validBillingStatuses.has(metadata?.billing_status as string);
  }).length;

  console.log("=".repeat(60));
  console.log("[Billing Audit] 📈 統計摘要");
  console.log("=".repeat(60));
  console.log(`  總完成任務: ${completedJobs?.length || 0}`);
  console.log(
    `  已扣款（總計）: ${Math.max(totalDeductions, chargedByStatus)}`,
  );
  console.log(`    - Token 扣款記錄: ${tokenDeductionCount}`);
  console.log(`    - 篇數扣款記錄: ${articleDeductionCount}`);
  console.log(`    - 有效 billing_status: ${chargedByStatus}`);
  console.log(`  未扣款: ${unchargedJobs.length}`);
  console.log(`  扣款失敗: ${billingFailedJobs.length}`);
  console.log("");

  // 如果有異常，退出碼設為 1（讓 GitHub Actions 失敗）
  if (unchargedJobs.length > 0 || billingFailedJobs.length > 0) {
    console.log("❌ 審計發現異常，請人工處理！\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[Billing Audit] ❌ Fatal error:", err);
  process.exit(1);
});
