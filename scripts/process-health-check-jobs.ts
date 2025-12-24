/**
 * 處理健康檢查任務的 GitHub Actions 腳本
 *
 * 由 GitHub Actions 每 5 分鐘執行一次，處理 pending 狀態的健康檢查任務。
 * 這個腳本在 GitHub Actions 環境中執行，沒有 Vercel 的時間限制。
 */

import { createClient } from "@supabase/supabase-js";
import { HealthCheckOrchestrator } from "../src/lib/services/health-check";
import type { DeviceType } from "../src/types/health-check";

// 初始化 Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 健康檢查 Job 類型
interface HealthCheckJob {
  id: string;
  website_id: string;
  company_id: string;
  status: string;
  url_to_check: string;
  device_type: DeviceType;
  include_ai_recommendations: boolean;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  result_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 取得待處理的健康檢查任務
 * 包含：
 * - status = 'pending' 的任務
 * - status = 'processing' 但超過 5 分鐘沒更新的任務（視為卡住）
 */
async function getPendingJobs(): Promise<HealthCheckJob[]> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: jobs, error } = await supabase
    .from("website_health_check_jobs")
    .select("*")
    .or(
      `status.eq.pending,and(status.eq.processing,started_at.lt.${fiveMinutesAgo})`,
    )
    .order("created_at", { ascending: true })
    .limit(5); // 每次處理最多 5 個任務

  if (error) {
    console.error("❌ Error fetching pending jobs:", error);
    return [];
  }

  return jobs || [];
}

/**
 * 更新任務狀態為 processing
 */
async function markJobAsProcessing(jobId: string): Promise<boolean> {
  const { error } = await supabase
    .from("website_health_check_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error(`❌ Error marking job ${jobId} as processing:`, error);
    return false;
  }

  return true;
}

/**
 * 標記任務為完成並儲存結果
 */
async function markJobAsCompleted(
  job: HealthCheckJob,
  result: Awaited<ReturnType<HealthCheckOrchestrator["execute"]>>,
): Promise<void> {
  // 先儲存健康檢查結果
  const { data: savedResult, error: resultError } = await supabase
    .from("website_health_checks")
    .insert({
      job_id: job.id,
      website_id: job.website_id,
      company_id: job.company_id,
      url_checked: result.url,
      device_type: result.deviceType,
      // Core Web Vitals
      lcp_ms: result.coreWebVitals.lcp_ms,
      inp_ms: result.coreWebVitals.inp_ms,
      cls: result.coreWebVitals.cls,
      fcp_ms: result.coreWebVitals.fcp_ms,
      ttfb_ms: result.coreWebVitals.ttfb_ms,
      // Lighthouse 分數
      performance_score: result.lighthouseScores.performance_score,
      accessibility_score: result.lighthouseScores.accessibility_score,
      seo_score: result.lighthouseScores.seo_score,
      best_practices_score: result.lighthouseScores.best_practices_score,
      // 詳細分析
      meta_analysis: result.metaAnalysis,
      ai_recommendations: result.aiRecommendations,
      // 基礎 SEO
      robots_txt_exists: result.robotsTxtExists,
      sitemap_exists: result.sitemapExists,
      sitemap_url: result.sitemapUrl,
    })
    .select("id")
    .single();

  if (resultError) {
    console.error(`❌ Error saving result for job ${job.id}:`, resultError);
    throw resultError;
  }

  // 更新 job 狀態
  const { error: jobError } = await supabase
    .from("website_health_check_jobs")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      result_id: savedResult.id,
    })
    .eq("id", job.id);

  if (jobError) {
    console.error(`❌ Error updating job ${job.id}:`, jobError);
    throw jobError;
  }

  console.log(
    `✅ Job ${job.id} completed successfully (result: ${savedResult.id})`,
  );
}

/**
 * 標記任務為失敗
 */
async function markJobAsFailed(
  jobId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase
    .from("website_health_check_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: errorMessage,
    })
    .eq("id", jobId);

  if (error) {
    console.error(`❌ Error marking job ${jobId} as failed:`, error);
  }
}

/**
 * 處理單一健康檢查任務
 */
async function processJob(job: HealthCheckJob): Promise<void> {
  console.log(`\n📋 Processing job ${job.id}`);
  console.log(`   URL: ${job.url_to_check}`);
  console.log(`   Device: ${job.device_type}`);

  // 標記為處理中
  const marked = await markJobAsProcessing(job.id);
  if (!marked) {
    console.log(`   ⚠️ Could not mark job as processing, skipping`);
    return;
  }

  try {
    // 執行健康檢查
    const orchestrator = new HealthCheckOrchestrator();
    const result = await orchestrator.execute({
      url: job.url_to_check,
      deviceType: job.device_type,
      includeAiRecommendations: job.include_ai_recommendations,
    });

    // 儲存結果
    await markJobAsCompleted(job, result);

    console.log(`   ⏱️ Execution time: ${result.executionTime}ms`);
    console.log(
      `   📊 Performance: ${result.lighthouseScores.performance_score ?? "N/A"}`,
    );
    console.log(`   📊 SEO: ${result.lighthouseScores.seo_score ?? "N/A"}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`   ❌ Error: ${errorMessage}`);
    await markJobAsFailed(job.id, errorMessage);
  }
}

/**
 * 主程式
 */
async function main(): Promise<void> {
  console.log("🔍 Health Check Job Processor");
  console.log("============================");
  console.log(`Started at: ${new Date().toISOString()}`);

  // 取得待處理的任務
  const jobs = await getPendingJobs();

  if (jobs.length === 0) {
    console.log("\n✅ No pending jobs found");
    return;
  }

  console.log(`\n📦 Found ${jobs.length} pending job(s)`);

  // 依序處理每個任務（避免同時打太多 API）
  for (const job of jobs) {
    await processJob(job);
  }

  console.log("\n============================");
  console.log(`Completed at: ${new Date().toISOString()}`);
}

// 執行主程式
main()
  .then(() => {
    console.log("\n✅ Process completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Process failed:", error);
    process.exit(1);
  });
