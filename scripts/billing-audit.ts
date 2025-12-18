#!/usr/bin/env tsx

/**
 * 每日 Billing 審計腳本
 *
 * 功能：
 * 1. 比對 completed jobs vs token_deduction_records
 * 2. 檢測 metadata.billing_status 為 "failed" 的任務
 * 3. 輸出未扣款任務清單
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

  // 2. 獲取扣款記錄
  // 注意：idempotency_key 存儲的是 article_job_id（見 migration 20251114000000）
  const { data: deductions, error: deductionsError } = await supabase
    .from("token_deduction_records")
    .select("idempotency_key")
    .gte("created_at", since);

  if (deductionsError) {
    console.error("[Billing Audit] ❌ 查詢 deductions 失敗:", deductionsError);
    process.exit(1);
  }

  console.log(`[Billing Audit] 📊 找到 ${deductions?.length || 0} 條扣款記錄`);

  // 3. 找出未扣款的任務
  const deductedJobIds = new Set(
    deductions?.map((d) => d.idempotency_key) || [],
  );

  const unchargedJobs = (completedJobs || []).filter((job) => {
    // 沒有扣款記錄
    if (!deductedJobIds.has(job.id)) {
      return true;
    }
    return false;
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
  console.log("=".repeat(60));
  console.log("[Billing Audit] 📈 統計摘要");
  console.log("=".repeat(60));
  console.log(`  總完成任務: ${completedJobs?.length || 0}`);
  console.log(`  已扣款: ${deductions?.length || 0}`);
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
