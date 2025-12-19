#!/usr/bin/env tsx

/**
 * 每日 Billing 審計腳本（含自動重試與告警）
 *
 * 功能：
 * 1. 比對 completed jobs vs 扣款記錄（支援新舊兩種計費系統）
 *    - 舊系統：token_deduction_records（Token 制）
 *    - 新系統：article_usage_logs（篇數制）
 * 2. 檢測 metadata.billing_status 為 "failed" 的任務
 * 3. 認可 "success" 和 "reconciled" 為有效扣款狀態
 * 4. 自動重試失敗的扣款
 * 5. 重試失敗後發送 Email 告警給管理員
 *
 * 用法：
 *   pnpm tsx scripts/billing-audit.ts
 *   pnpm tsx scripts/billing-audit.ts --days=7      # 檢查過去 7 天
 *   pnpm tsx scripts/billing-audit.ts --no-retry    # 只審計，不重試
 *   pnpm tsx scripts/billing-audit.ts --no-email    # 不發送告警 Email
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";
import { sendBillingAlertEmail, type FailedBillingJob } from "../src/lib/email";

// 定義 Job 類型
interface AuditJob {
  id: string;
  company_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// 重試結果類型
interface RetryResult {
  jobId: string;
  companyId: string;
  success: boolean;
  error?: string;
}

async function main() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 解析參數
  const args = process.argv;
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1]) : 1;
  const enableRetry = !args.includes("--no-retry");
  const enableEmail = !args.includes("--no-email");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  console.log(`[Billing Audit] 🔍 檢查過去 ${days} 天的任務...`);
  console.log(`[Billing Audit] 📅 起始時間: ${since}`);
  console.log(`[Billing Audit] 🔄 自動重試: ${enableRetry ? "啟用" : "停用"}`);
  console.log(
    `[Billing Audit] 📧 Email 告警: ${enableEmail ? "啟用" : "停用"}`,
  );

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

  // 3. 找出未扣款的任務
  const deductedJobIds = new Set([
    ...(tokenDeductions?.map((d) => d.idempotency_key) || []),
    ...(articleDeductions?.map((d) => d.article_job_id) || []),
  ]);

  const validBillingStatuses = new Set(["success", "reconciled"]);

  const typedJobs = (completedJobs || []) as AuditJob[];

  const unchargedJobs = typedJobs.filter((job) => {
    if (validBillingStatuses.has(job.metadata?.billing_status as string)) {
      return false;
    }
    if (deductedJobIds.has(job.id)) {
      return false;
    }
    return true;
  });

  // 4. 找出 billing_status = "failed" 的任務
  const billingFailedJobs = typedJobs.filter((job) => {
    return job.metadata?.billing_status === "failed";
  });

  // 合併需要重試的任務（未扣款 + 明確失敗）
  const jobsToRetry = [
    ...unchargedJobs,
    ...billingFailedJobs.filter(
      (j) => !unchargedJobs.some((u) => u.id === j.id),
    ),
  ];

  console.log("\n" + "=".repeat(60));
  console.log("[Billing Audit] 📋 審計結果");
  console.log("=".repeat(60));

  // 如果沒有問題，提前退出
  if (jobsToRetry.length === 0) {
    console.log("\n✅ 所有任務都已正常扣款，沒有異常！\n");
    process.exit(0);
  }

  console.log(`\n🚨 發現 ${jobsToRetry.length} 個需要處理的任務`);

  // 5. 自動重試
  const retryResults: RetryResult[] = [];

  if (enableRetry && jobsToRetry.length > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("[Billing Audit] 🔄 開始自動重試...");
    console.log("-".repeat(60));

    for (const job of jobsToRetry) {
      console.log(`\n  正在處理: ${job.id}`);
      console.log(`  公司 ID: ${job.company_id}`);

      try {
        // 調用 deduct_article_quota RPC
        const { data, error } = await (supabase.rpc as CallableFunction)(
          "deduct_article_quota",
          {
            p_company_id: job.company_id,
            p_article_job_id: job.id,
            p_user_id: null,
            p_article_title: null,
            p_keywords: null,
          },
        );

        if (error) {
          console.log(`  ❌ 重試失敗: ${error.message}`);
          retryResults.push({
            jobId: job.id,
            companyId: job.company_id,
            success: false,
            error: error.message,
          });
          continue;
        }

        const result = data as Record<string, unknown>;

        if (!result.success) {
          const errorMsg =
            (result.error as string) ||
            (result.message as string) ||
            "未知錯誤";
          console.log(`  ❌ 重試失敗: ${errorMsg}`);
          retryResults.push({
            jobId: job.id,
            companyId: job.company_id,
            success: false,
            error: errorMsg,
          });

          // 更新 metadata 記錄重試失敗
          await supabase
            .from("article_jobs")
            .update({
              metadata: {
                ...job.metadata,
                billing_status: "failed",
                billing_error: errorMsg,
                billing_retry_at: new Date().toISOString(),
                billing_retry_failed: true,
              },
            })
            .eq("id", job.id);
        } else {
          console.log(`  ✅ 重試成功！扣款來源: ${result.deducted_from}`);
          retryResults.push({
            jobId: job.id,
            companyId: job.company_id,
            success: true,
          });

          // 更新 metadata 為 reconciled
          await supabase
            .from("article_jobs")
            .update({
              metadata: {
                ...job.metadata,
                billing_status: "reconciled",
                billing_reconciled_at: new Date().toISOString(),
                billing_reconciled_by: "billing-audit-script",
              },
            })
            .eq("id", job.id);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "執行錯誤";
        console.log(`  ❌ 重試異常: ${errorMsg}`);
        retryResults.push({
          jobId: job.id,
          companyId: job.company_id,
          success: false,
          error: errorMsg,
        });
      }
    }
  }

  // 6. 統計重試結果
  const retrySuccessCount = retryResults.filter((r) => r.success).length;
  const retryFailedCount = retryResults.filter((r) => !r.success).length;
  const stillFailedJobs = retryResults.filter((r) => !r.success);

  console.log("\n" + "=".repeat(60));
  console.log("[Billing Audit] 📈 處理結果");
  console.log("=".repeat(60));
  console.log(`  總需處理: ${jobsToRetry.length}`);
  console.log(`  重試成功: ${retrySuccessCount}`);
  console.log(`  仍需人工: ${retryFailedCount}`);

  // 7. 發送 Email 告警（僅在仍有失敗時）
  if (enableEmail && stillFailedJobs.length > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("[Billing Audit] 📧 發送告警 Email...");
    console.log("-".repeat(60));

    // 獲取公司名稱
    const companyIds = [...new Set(stillFailedJobs.map((j) => j.companyId))];
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds);

    const companyMap = new Map(companies?.map((c) => [c.id, c.name]) || []);

    // 準備 Email 資料
    const failedJobsForEmail: FailedBillingJob[] = stillFailedJobs.map((r) => {
      const job = jobsToRetry.find((j) => j.id === r.jobId)!;
      return {
        jobId: r.jobId,
        companyId: r.companyId,
        companyName: companyMap.get(r.companyId) || undefined,
        error: r.error || "未知錯誤",
        createdAt: job.created_at,
      };
    });

    const emailSent = await sendBillingAlertEmail({
      failedJobs: failedJobsForEmail,
      retrySuccessCount,
      retryFailedCount,
    });

    if (emailSent) {
      console.log("  ✅ 告警 Email 已發送");
    } else {
      console.log("  ❌ 告警 Email 發送失敗");
    }
  }

  // 8. 完整統計摘要
  const totalDeductions = tokenDeductionCount + articleDeductionCount;
  const chargedByStatus = typedJobs.filter((job) => {
    return validBillingStatuses.has(job.metadata?.billing_status as string);
  }).length;

  console.log("\n" + "=".repeat(60));
  console.log("[Billing Audit] 📊 完整統計");
  console.log("=".repeat(60));
  console.log(`  總完成任務: ${typedJobs.length}`);
  console.log(
    `  已扣款（總計）: ${Math.max(totalDeductions, chargedByStatus) + retrySuccessCount}`,
  );
  console.log(`    - Token 扣款記錄: ${tokenDeductionCount}`);
  console.log(`    - 篇數扣款記錄: ${articleDeductionCount}`);
  console.log(`    - 有效 billing_status: ${chargedByStatus}`);
  console.log(`    - 本次補扣成功: ${retrySuccessCount}`);
  console.log(`  仍未扣款: ${retryFailedCount}`);
  console.log("");

  // 如果仍有失敗，退出碼設為 1
  if (stillFailedJobs.length > 0) {
    console.log("❌ 審計發現異常，已發送告警！\n");
    process.exit(1);
  }

  console.log("✅ 所有問題已自動處理完成！\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("[Billing Audit] ❌ Fatal error:", err);
  process.exit(1);
});
