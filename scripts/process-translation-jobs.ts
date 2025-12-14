#!/usr/bin/env tsx

/**
 * 翻譯任務批量處理腳本
 *
 * 由 GitHub Actions 定時執行，處理 pending 的翻譯任務
 */

import { createClient } from "@supabase/supabase-js";
import { TranslationAgent } from "../src/lib/agents/translation-agent";
import type { Database } from "../src/types/database.types";
import type {
  TranslationLocale,
  TranslationJobWithSource,
} from "../src/types/translations";

const MAX_RETRIES = 2;

/**
 * 判斷錯誤是否可重試
 */
function isRetryableError(errorMessage: string): boolean {
  const nonRetryablePatterns = [
    "Invalid API key",
    "Unauthorized",
    "invalid_request",
    "Access denied",
  ];
  return !nonRetryablePatterns.some((p) =>
    errorMessage.toLowerCase().includes(p.toLowerCase()),
  );
}

async function main() {
  console.log("[Translation Jobs] 🚀 啟動翻譯任務處理器");

  // 檢查必要的環境變數
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Translation Jobs] ❌ 缺少必要的環境變數");
    process.exit(1);
  }

  const supabase = createClient<Database>(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  console.log("[Translation Jobs] 🔍 查詢待處理翻譯任務...");

  // 查詢待處理任務：
  // 1. status 為 pending 或 processing
  // 2. started_at 為 null（未開始）或超過 5 分鐘（卡住的任務）
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: jobs, error } = await supabase
    .from("translation_jobs")
    .select(
      `
      *,
      generated_articles!source_article_id (
        id,
        title,
        slug,
        html_content,
        markdown_content,
        excerpt,
        seo_title,
        seo_description,
        focus_keyword,
        keywords,
        categories,
        tags,
        og_title,
        og_description
      )
    `,
    )
    .in("status", ["pending", "processing"])
    .or(`started_at.is.null,started_at.lt.${fiveMinutesAgo}`)
    .order("created_at", { ascending: true })
    .limit(10);

  if (error) {
    console.error("[Translation Jobs] ❌ 查詢失敗:", error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("[Translation Jobs] ✅ 沒有待處理翻譯任務");
    return;
  }

  console.log(`[Translation Jobs] 🔄 發現 ${jobs.length} 個翻譯任務`);

  // 逐個處理任務（翻譯任務較重，避免並行太多）
  for (const job of jobs) {
    await processTranslationJob(
      supabase,
      job as unknown as TranslationJobWithSource,
      fiveMinutesAgo,
    );
  }

  console.log("[Translation Jobs] ✅ 所有翻譯任務處理完成");
}

/**
 * 處理單個翻譯任務
 */
async function processTranslationJob(
  supabase: ReturnType<typeof createClient<Database>>,
  job: TranslationJobWithSource,
  lockThreshold: string,
) {
  console.log(`[Translation Jobs] 🔒 嘗試鎖定任務 ${job.id}`);

  const lockTimestamp = new Date().toISOString();

  // 樂觀鎖定
  const { error: lockError } = await supabase
    .from("translation_jobs")
    .update({
      status: "processing",
      started_at: lockTimestamp,
    })
    .eq("id", job.id)
    .in("status", ["pending", "processing"])
    .or(`started_at.is.null,started_at.lt.${lockThreshold}`);

  if (lockError) {
    console.log(
      `[Translation Jobs] ❌ 鎖定任務失敗 ${job.id}: ${lockError.message}`,
    );
    return;
  }

  // 驗證鎖定
  const { data: locked } = await supabase
    .from("translation_jobs")
    .select("*")
    .eq("id", job.id)
    .eq("started_at", lockTimestamp)
    .single();

  if (!locked) {
    console.log(`[Translation Jobs] ⏭️  任務 ${job.id} 已被其他程序處理，跳過`);
    return;
  }

  console.log(`[Translation Jobs] ✅ 成功鎖定任務 ${job.id}`);

  // 檢查來源文章
  const sourceArticle = job.generated_articles;
  if (!sourceArticle) {
    console.error(
      `[Translation Jobs] ❌ 找不到來源文章 ${job.source_article_id}`,
    );
    await markJobFailed(supabase, job.id, "Source article not found");
    return;
  }

  console.log(`[Translation Jobs] 📝 來源文章: ${sourceArticle.title}`);
  console.log(
    `[Translation Jobs] 🌐 目標語言: ${job.target_languages.join(", ")}`,
  );

  const completedLanguages: TranslationLocale[] = [
    ...(job.completed_languages as TranslationLocale[]),
  ];
  const failedLanguages: Record<string, string> = {
    ...(job.failed_languages as Record<string, string>),
  };

  // 計算需要翻譯的語言
  const pendingLanguages = job.target_languages.filter(
    (lang) =>
      !completedLanguages.includes(lang as TranslationLocale) &&
      !Object.keys(failedLanguages).includes(lang),
  );

  const totalLanguages = job.target_languages.length;

  // 逐個語言翻譯
  for (let i = 0; i < pendingLanguages.length; i++) {
    const targetLanguage = pendingLanguages[i] as TranslationLocale;

    console.log(
      `[Translation Jobs] 🔄 翻譯 ${targetLanguage} (${i + 1}/${pendingLanguages.length})`,
    );

    // 更新進度
    const progress = Math.round(
      ((completedLanguages.length + i) / totalLanguages) * 100,
    );
    await supabase
      .from("translation_jobs")
      .update({
        progress,
        current_language: targetLanguage,
      })
      .eq("id", job.id);

    try {
      await translateToLanguage(supabase, job, sourceArticle, targetLanguage);

      completedLanguages.push(targetLanguage);
      console.log(`[Translation Jobs] ✅ ${targetLanguage} 翻譯完成`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[Translation Jobs] ❌ ${targetLanguage} 翻譯失敗:`,
        errorMessage,
      );
      failedLanguages[targetLanguage] = errorMessage;
    }
  }

  // 更新任務狀態
  const allCompleted =
    completedLanguages.length === totalLanguages ||
    completedLanguages.length + Object.keys(failedLanguages).length ===
      totalLanguages;

  const finalStatus = allCompleted
    ? Object.keys(failedLanguages).length === totalLanguages
      ? "failed"
      : "completed"
    : "processing";

  const finalProgress = Math.round(
    ((completedLanguages.length + Object.keys(failedLanguages).length) /
      totalLanguages) *
      100,
  );

  await supabase
    .from("translation_jobs")
    .update({
      status: finalStatus,
      progress: finalProgress,
      current_language: null,
      completed_languages: completedLanguages,
      failed_languages: failedLanguages,
      completed_at:
        finalStatus === "completed" || finalStatus === "failed"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", job.id);

  console.log(
    `[Translation Jobs] 📊 任務 ${job.id} 狀態: ${finalStatus} ` +
      `(完成: ${completedLanguages.length}, 失敗: ${Object.keys(failedLanguages).length})`,
  );
}

/**
 * 翻譯到指定語言
 */
async function translateToLanguage(
  supabase: ReturnType<typeof createClient<Database>>,
  job: TranslationJobWithSource,
  sourceArticle: TranslationJobWithSource["generated_articles"],
  targetLanguage: TranslationLocale,
) {
  // 建立 TranslationAgent
  const agent = new TranslationAgent(
    {
      defaultModel: "deepseek-chat",
      temperature: 0.3,
    },
    {
      websiteId: job.website_id || "",
      companyId: job.company_id,
      articleJobId: job.id,
    },
  );

  // 執行翻譯
  const result = await agent.execute({
    sourceArticle: {
      id: sourceArticle.id,
      title: sourceArticle.title,
      markdown_content: sourceArticle.markdown_content,
      html_content: sourceArticle.html_content,
      excerpt: sourceArticle.excerpt,
      seo_title: sourceArticle.seo_title,
      seo_description: sourceArticle.seo_description,
      focus_keyword: sourceArticle.focus_keyword,
      keywords: sourceArticle.keywords || [],
      categories: sourceArticle.categories || [],
      tags: sourceArticle.tags || [],
      og_title: sourceArticle.og_title,
      og_description: sourceArticle.og_description,
    },
    sourceLanguage: "zh-TW",
    targetLanguage,
    model: "deepseek-chat",
    temperature: 0.3,
  });

  // 儲存翻譯結果
  const { error: insertError } = await supabase
    .from("article_translations")
    .upsert(
      {
        source_article_id: job.source_article_id,
        company_id: job.company_id,
        website_id: job.website_id,
        user_id: job.user_id,
        source_language: "zh-TW",
        target_language: targetLanguage,
        title: result.title,
        slug: result.slug,
        markdown_content: result.markdown_content,
        html_content: result.html_content,
        excerpt: result.excerpt,
        seo_title: result.seo_title,
        seo_description: result.seo_description,
        focus_keyword: result.focus_keyword,
        keywords: result.keywords,
        categories: result.categories,
        tags: result.tags,
        og_title: result.og_title,
        og_description: result.og_description,
        word_count: result.word_count,
        reading_time: result.reading_time,
        paragraph_count: result.paragraph_count,
        sentence_count: result.sentence_count,
        translation_model: result.executionInfo.model,
        translation_tokens: result.executionInfo.tokenUsage,
        translation_cost: result.executionInfo.cost,
        translation_time: Math.round(result.executionInfo.executionTime / 1000),
        status: "published", // 自動發布
        published_at: new Date().toISOString(),
      },
      {
        onConflict: "source_article_id,target_language",
      },
    );

  if (insertError) {
    throw new Error(`Failed to save translation: ${insertError.message}`);
  }
}

/**
 * 標記任務為失敗
 */
async function markJobFailed(
  supabase: ReturnType<typeof createClient<Database>>,
  jobId: string,
  errorMessage: string,
) {
  await supabase
    .from("translation_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

// 執行
main().catch((error) => {
  console.error("[Translation Jobs] ❌ 程序錯誤:", error);
  process.exit(1);
});
