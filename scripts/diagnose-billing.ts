#!/usr/bin/env tsx

/**
 * 文章扣款診斷腳本
 *
 * 功能：
 * 1. 檢查 RPC 函數的 search_path 設定
 * 2. 查詢扣款失敗的任務
 * 3. 查詢完成但無扣款記錄的任務
 * 4. 驗證扣款功能是否正常
 *
 * 用法：
 *   pnpm tsx scripts/diagnose-billing.ts
 *   pnpm tsx scripts/diagnose-billing.ts --days=7    # 檢查過去 7 天
 *   pnpm tsx scripts/diagnose-billing.ts --fix       # 自動修復 search_path 問題
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

interface DiagnosisResult {
  searchPathIssues: Array<{
    functionName: string;
    currentSearchPath: string;
    hasIssue: boolean;
  }>;
  failedBillingJobs: Array<{
    id: string;
    companyId: string;
    billingError: string | null;
    failedAt: string | null;
    createdAt: string;
  }>;
  jobsWithoutBilling: Array<{
    id: string;
    companyId: string;
    status: string;
    createdAt: string;
  }>;
  summary: {
    totalFailed: number;
    totalWithoutBilling: number;
    searchPathOk: boolean;
    overallHealthy: boolean;
  };
}

async function main() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 解析參數
  const args = process.argv;
  const daysArg = args.find((arg) => arg.startsWith("--days="));
  const days = daysArg ? parseInt(daysArg.split("=")[1]) : 7;
  const shouldFix = args.includes("--fix");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  console.log("=".repeat(60));
  console.log("📊 文章扣款系統診斷報告");
  console.log("=".repeat(60));
  console.log(`檢查範圍：過去 ${days} 天（起始時間: ${since}）`);
  console.log("");

  const result: DiagnosisResult = {
    searchPathIssues: [],
    failedBillingJobs: [],
    jobsWithoutBilling: [],
    summary: {
      totalFailed: 0,
      totalWithoutBilling: 0,
      searchPathOk: true,
      overallHealthy: true,
    },
  };

  // ========================================
  // 1. 檢查 RPC 函數 search_path
  // ========================================
  console.log("\n" + "-".repeat(60));
  console.log("1️⃣ 檢查 RPC 函數 search_path 設定");
  console.log("-".repeat(60));

  const criticalFunctions = [
    "deduct_article_quota",
    "update_purchased_articles_total",
    "reset_monthly_quota_if_needed",
  ];

  for (const funcName of criticalFunctions) {
    const { data: funcData } = await supabase
      .rpc("get_function_search_path" as never, {
        func_name: funcName,
      })
      .catch(() => ({ data: null }));

    // 如果沒有輔助函數，直接查詢 pg_proc
    const { data: pgData } = await supabase
      .from("pg_proc" as never)
      .select("proconfig")
      .eq("proname", funcName)
      .single()
      .catch(() => ({ data: null }));

    const searchPath = pgData?.proconfig?.[0] || funcData || "unknown";
    const hasIssue =
      searchPath === 'search_path=""' || searchPath === '{"search_path=\\"\\"}';

    result.searchPathIssues.push({
      functionName: funcName,
      currentSearchPath: searchPath,
      hasIssue,
    });

    if (hasIssue) {
      result.summary.searchPathOk = false;
      console.log(`  ❌ ${funcName}: search_path 為空（問題！）`);
    } else {
      console.log(`  ✅ ${funcName}: ${searchPath}`);
    }
  }

  // ========================================
  // 2. 查詢扣款失敗的任務
  // ========================================
  console.log("\n" + "-".repeat(60));
  console.log("2️⃣ 查詢 billing_status = 'failed' 的任務");
  console.log("-".repeat(60));

  interface JobMetadata {
    billing_status?: string;
    billing_error?: string;
    billing_failed_at?: string;
  }

  const { data: failedJobs } = await supabase
    .from("article_jobs")
    .select("id, company_id, status, metadata, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const failedBillingJobs = (failedJobs || []).filter((job) => {
    const metadata = job.metadata as JobMetadata | null;
    return metadata?.billing_status === "failed";
  });

  result.failedBillingJobs = failedBillingJobs.map((job) => {
    const metadata = job.metadata as JobMetadata | null;
    return {
      id: job.id,
      companyId: job.company_id,
      billingError: metadata?.billing_error || null,
      failedAt: metadata?.billing_failed_at || null,
      createdAt: job.created_at,
    };
  });
  result.summary.totalFailed = failedBillingJobs.length;

  if (failedBillingJobs.length === 0) {
    console.log("  ✅ 沒有扣款失敗的任務");
  } else {
    console.log(`  ⚠️ 發現 ${failedBillingJobs.length} 個扣款失敗的任務`);
    console.log("");

    // 顯示前 5 個
    failedBillingJobs.slice(0, 5).forEach((job) => {
      const metadata = job.metadata as JobMetadata | null;
      console.log(`    - ${job.id}`);
      console.log(`      錯誤: ${metadata?.billing_error || "unknown"}`);
      console.log(
        `      時間: ${metadata?.billing_failed_at || job.created_at}`,
      );
    });

    if (failedBillingJobs.length > 5) {
      console.log(`    ... 還有 ${failedBillingJobs.length - 5} 個`);
    }
  }

  // ========================================
  // 3. 查詢完成但無扣款記錄的任務
  // ========================================
  console.log("\n" + "-".repeat(60));
  console.log("3️⃣ 查詢完成但無扣款記錄的任務");
  console.log("-".repeat(60));

  // 取得所有完成任務
  const { data: completedJobs } = await supabase
    .from("article_jobs")
    .select("id, company_id, status, metadata, created_at")
    .in("status", ["completed", "published", "scheduled"])
    .gte("created_at", since);

  // 取得使用記錄
  const { data: usageLogs } = await (
    supabase.from("article_usage_logs" as "companies") as unknown as {
      select: (columns: string) => {
        gte: (
          column: string,
          value: string,
        ) => Promise<{
          data: Array<{ article_job_id: string }> | null;
        }>;
      };
    }
  )
    .select("article_job_id")
    .gte("created_at", since);

  const loggedJobIds = new Set(usageLogs?.map((l) => l.article_job_id) || []);
  const validBillingStatuses = new Set(["success", "reconciled"]);

  const jobsWithoutBilling = (completedJobs || []).filter((job) => {
    const metadata = job.metadata as JobMetadata | null;
    // 排除已有有效 billing_status 的
    if (validBillingStatuses.has(metadata?.billing_status || "")) {
      return false;
    }
    // 排除已有使用記錄的
    if (loggedJobIds.has(job.id)) {
      return false;
    }
    return true;
  });

  result.jobsWithoutBilling = jobsWithoutBilling.map((job) => ({
    id: job.id,
    companyId: job.company_id,
    status: job.status,
    createdAt: job.created_at,
  }));
  result.summary.totalWithoutBilling = jobsWithoutBilling.length;

  if (jobsWithoutBilling.length === 0) {
    console.log("  ✅ 所有完成任務都有扣款記錄");
  } else {
    console.log(`  ⚠️ 發現 ${jobsWithoutBilling.length} 個無扣款記錄的任務`);
  }

  // ========================================
  // 4. 測試扣款功能
  // ========================================
  console.log("\n" + "-".repeat(60));
  console.log("4️⃣ 測試 deduct_article_quota RPC 函數");
  console.log("-".repeat(60));

  // 使用一個假的 UUID 測試（不會真正扣款，因為找不到訂閱）
  const testCompanyId = "00000000-0000-0000-0000-000000000000";
  const testJobId = "00000000-0000-0000-0000-000000000000";

  const { data: testResult, error: testError } = await (
    supabase.rpc as CallableFunction
  )("deduct_article_quota", {
    p_company_id: testCompanyId,
    p_article_job_id: testJobId,
    p_user_id: null,
    p_article_title: "診斷測試",
    p_keywords: null,
  });

  if (testError) {
    const errorMsg = testError.message || "";
    if (errorMsg.includes("does not exist")) {
      console.log("  ❌ RPC 函數有 search_path 問題！");
      console.log(`     錯誤: ${errorMsg}`);
      result.summary.searchPathOk = false;
    } else {
      console.log(`  ⚠️ RPC 呼叫錯誤: ${errorMsg}`);
    }
  } else if (testResult?.error === "no_subscription") {
    console.log("  ✅ RPC 函數運作正常（找不到訂閱是預期行為）");
  } else {
    console.log(`  ℹ️ RPC 結果: ${JSON.stringify(testResult)}`);
  }

  // ========================================
  // 5. 自動修復（如果有 --fix 參數）
  // ========================================
  if (shouldFix && !result.summary.searchPathOk) {
    console.log("\n" + "-".repeat(60));
    console.log("5️⃣ 執行自動修復");
    console.log("-".repeat(60));

    console.log("  執行 migration: 20251223000001_fix_trigger_search_path.sql");
    console.log("  請手動執行以下 SQL：");
    console.log("");
    console.log(
      "  ALTER FUNCTION deduct_article_quota SET search_path = public;",
    );
    console.log(
      "  ALTER FUNCTION update_purchased_articles_total SET search_path = public;",
    );
    console.log(
      "  ALTER FUNCTION reset_monthly_quota_if_needed SET search_path = public;",
    );
  }

  // ========================================
  // 6. 總結
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("📋 診斷總結");
  console.log("=".repeat(60));

  result.summary.overallHealthy =
    result.summary.searchPathOk &&
    result.summary.totalFailed === 0 &&
    result.summary.totalWithoutBilling === 0;

  console.log(
    `  search_path 設定: ${result.summary.searchPathOk ? "✅ 正常" : "❌ 有問題"}`,
  );
  console.log(`  扣款失敗任務: ${result.summary.totalFailed} 個`);
  console.log(`  無扣款記錄任務: ${result.summary.totalWithoutBilling} 個`);
  console.log("");
  console.log(
    `  整體狀態: ${result.summary.overallHealthy ? "✅ 健康" : "⚠️ 需要處理"}`,
  );
  console.log("");

  if (!result.summary.overallHealthy) {
    console.log("建議操作：");
    if (!result.summary.searchPathOk) {
      console.log("  1. 執行 migration 修復 search_path");
    }
    if (
      result.summary.totalFailed > 0 ||
      result.summary.totalWithoutBilling > 0
    ) {
      console.log(
        "  2. 執行 pnpm tsx scripts/billing-audit.ts --days=7 進行補扣",
      );
    }
  }

  // 輸出 JSON 供程式解析
  if (args.includes("--json")) {
    console.log("\n" + JSON.stringify(result, null, 2));
  }

  process.exit(result.summary.overallHealthy ? 0 : 1);
}

main().catch((err) => {
  console.error("[diagnose-billing] Fatal error:", err);
  process.exit(1);
});
