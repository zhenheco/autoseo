#!/usr/bin/env tsx

/**
 * Billing 補扣腳本（備用）
 *
 * 功能：
 * 1. 查詢所有 billing_status = "failed" 或未扣款的 jobs
 * 2. 計算需要補扣的金額
 * 3. 執行補扣（需要手動確認）
 *
 * 用法：
 *   pnpm tsx scripts/billing-reconciliation.ts --dry-run   # 只顯示，不執行
 *   pnpm tsx scripts/billing-reconciliation.ts --execute   # 實際執行補扣
 *   pnpm tsx scripts/billing-reconciliation.ts --company=<company_id>  # 只處理特定公司
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.types";

interface JobWithTokenUsage {
  id: string;
  company_id: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  generated_articles: {
    token_usage: Record<string, unknown> | null;
  } | null;
}

function calculateChargedTokens(
  tokenUsage: Record<string, unknown> | null,
): number {
  if (!tokenUsage) return 0;

  const rawTotal =
    (parseInt(String(tokenUsage?.research?.input || 0)) || 0) +
    (parseInt(String(tokenUsage?.research?.output || 0)) || 0) +
    (parseInt(String(tokenUsage?.strategy?.input || 0)) || 0) +
    (parseInt(String(tokenUsage?.strategy?.output || 0)) || 0) +
    (parseInt(String(tokenUsage?.writing?.input || 0)) || 0) +
    (parseInt(String(tokenUsage?.writing?.output || 0)) || 0) +
    (parseInt(String(tokenUsage?.meta?.input || 0)) || 0) +
    (parseInt(String(tokenUsage?.meta?.output || 0)) || 0);

  return Math.ceil(rawTotal * 0.2);
}

async function main() {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 解析參數
  const isDryRun = !process.argv.includes("--execute");
  const companyArg = process.argv.find((arg) => arg.startsWith("--company="));
  const targetCompany = companyArg ? companyArg.split("=")[1] : null;

  console.log("[Reconciliation] 🔧 Billing 補扣腳本");
  console.log(
    `[Reconciliation] 模式: ${isDryRun ? "預覽（dry-run）" : "⚠️ 執行模式"}`,
  );
  if (targetCompany) {
    console.log(`[Reconciliation] 目標公司: ${targetCompany}`);
  }
  console.log("");

  // 1. 查詢未扣款的 jobs（含 token_usage）
  let query = supabase
    .from("article_jobs")
    .select(
      `
      id,
      company_id,
      status,
      metadata,
      created_at,
      generated_articles!inner(token_usage)
    `,
    )
    .in("status", ["completed", "scheduled", "published"]);

  if (targetCompany) {
    query = query.eq("company_id", targetCompany);
  }

  const { data: jobs, error } = await query;

  if (error) {
    console.error("[Reconciliation] ❌ 查詢失敗:", error);
    process.exit(1);
  }

  // 2. 獲取已有的扣款記錄
  const { data: deductions } = await supabase
    .from("token_deduction_records")
    .select("article_job_id");

  const deductedJobIds = new Set(
    deductions?.map((d) => d.article_job_id) || [],
  );

  // 3. 過濾出需要補扣的 jobs
  const jobsToReconcile = (
    (jobs as unknown as JobWithTokenUsage[]) || []
  ).filter((job) => {
    // 已有扣款記錄的跳過
    if (deductedJobIds.has(job.id)) return false;

    // 沒有 token_usage 的跳過
    if (!job.generated_articles?.token_usage) return false;

    return true;
  });

  console.log(
    `[Reconciliation] 📊 找到 ${jobsToReconcile.length} 個需要補扣的任務`,
  );

  if (jobsToReconcile.length === 0) {
    console.log("\n✅ 沒有需要補扣的任務！\n");
    process.exit(0);
  }

  // 4. 按公司分組計算
  const companyTotals = new Map<
    string,
    { jobs: typeof jobsToReconcile; total: number }
  >();

  for (const job of jobsToReconcile) {
    const charged = calculateChargedTokens(
      job.generated_articles?.token_usage as Record<string, unknown> | null,
    );

    if (!companyTotals.has(job.company_id)) {
      companyTotals.set(job.company_id, { jobs: [], total: 0 });
    }

    const entry = companyTotals.get(job.company_id)!;
    entry.jobs.push(job);
    entry.total += charged;
  }

  // 5. 顯示補扣計劃
  console.log("\n" + "=".repeat(60));
  console.log("[Reconciliation] 📋 補扣計劃");
  console.log("=".repeat(60));

  for (const [companyId, data] of companyTotals) {
    // 獲取公司名稱
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .single();

    console.log(`\n公司: ${company?.name || companyId}`);
    console.log(`  任務數: ${data.jobs.length}`);
    console.log(`  總補扣: ${data.total.toLocaleString()} tokens`);

    if (data.jobs.length <= 5) {
      data.jobs.forEach((job) => {
        const charged = calculateChargedTokens(
          job.generated_articles?.token_usage as Record<string, unknown> | null,
        );
        console.log(`    - ${job.id}: ${charged.toLocaleString()} tokens`);
      });
    }
  }

  console.log("\n" + "=".repeat(60));

  // 6. 執行補扣（如果不是 dry-run）
  if (isDryRun) {
    console.log("\n⏸️  預覽模式，未執行任何補扣");
    console.log("   使用 --execute 參數來實際執行補扣\n");
    process.exit(0);
  }

  console.log("\n⚠️  開始執行補扣...\n");

  let successCount = 0;
  let failCount = 0;

  for (const [companyId, data] of companyTotals) {
    // 獲取當前餘額
    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select("monthly_quota_balance, purchased_token_balance")
      .eq("company_id", companyId)
      .single();

    if (!subscription) {
      console.log(`❌ 公司 ${companyId} 沒有 subscription 記錄，跳過`);
      failCount += data.jobs.length;
      continue;
    }

    // 優先從 monthly_quota_balance 扣，不足時從 purchased_token_balance 扣
    let remaining = data.total;
    let monthlyDeduct = 0;
    let purchasedDeduct = 0;

    if (subscription.monthly_quota_balance >= remaining) {
      monthlyDeduct = remaining;
    } else {
      monthlyDeduct = subscription.monthly_quota_balance;
      remaining -= monthlyDeduct;
      purchasedDeduct = Math.min(
        remaining,
        subscription.purchased_token_balance,
      );
    }

    // 執行扣款
    const { error: updateError } = await supabase
      .from("company_subscriptions")
      .update({
        monthly_quota_balance:
          subscription.monthly_quota_balance - monthlyDeduct,
        purchased_token_balance:
          subscription.purchased_token_balance - purchasedDeduct,
      })
      .eq("company_id", companyId);

    if (updateError) {
      console.log(`❌ 公司 ${companyId} 扣款失敗: ${updateError.message}`);
      failCount += data.jobs.length;
    } else {
      console.log(
        `✅ 公司 ${companyId} 扣款成功: ${data.total.toLocaleString()} tokens`,
      );
      successCount += data.jobs.length;

      // 更新 jobs 的 metadata
      for (const job of data.jobs) {
        await supabase
          .from("article_jobs")
          .update({
            metadata: {
              ...(job.metadata || {}),
              billing_status: "reconciled",
              reconciled_at: new Date().toISOString(),
              reconciled_amount: calculateChargedTokens(
                job.generated_articles?.token_usage as Record<
                  string,
                  unknown
                > | null,
              ),
            },
          })
          .eq("id", job.id);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("[Reconciliation] 📈 執行結果");
  console.log("=".repeat(60));
  console.log(`  成功: ${successCount}`);
  console.log(`  失敗: ${failCount}`);
  console.log("");
}

main().catch((err) => {
  console.error("[Reconciliation] ❌ Fatal error:", err);
  process.exit(1);
});
