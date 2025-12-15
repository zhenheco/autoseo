#!/usr/bin/env tsx

/**
 * 翻譯任務批量處理腳本
 *
 * 由 GitHub Actions 定時執行，處理 pending 的翻譯任務
 *
 * 🔧 優化：
 * - 兩階段查詢：先查任務列表，再查文章內容
 * - Redis 快取：減少重複查詢文章內容
 */

// 載入環境變數（本地開發用）
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { TranslationAgent } from "../src/lib/agents/translation-agent";
import { getNextGoldenSlotISO } from "../src/lib/scheduling/golden-slots";
import {
  cacheGet,
  cacheSet,
  cacheDelete,
  isRedisAvailable,
} from "../src/lib/cache/redis-cache";
import type { Database } from "../src/types/database.types";
import type {
  TranslationLocale,
  TranslationJobWithSource,
} from "../src/types/translations";

const MAX_RETRIES = 2;
const CACHE_KEY_PENDING_TRANSLATION = "jobs:pending:translation";
const CACHE_KEY_ARTICLE_PREFIX = "cache:article:full";

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

/**
 * 從 Redis 或資料庫取得文章內容
 * 優化：同一篇文章的多語系翻譯只查詢一次資料庫
 */
async function getArticleContent(
  supabase: ReturnType<typeof createClient<Database>>,
  articleId: string,
): Promise<TranslationJobWithSource["generated_articles"] | null> {
  const cacheKey = `${CACHE_KEY_ARTICLE_PREFIX}:${articleId}`;

  // 嘗試從 Redis 取得
  if (isRedisAvailable()) {
    try {
      const cached =
        await cacheGet<TranslationJobWithSource["generated_articles"]>(
          cacheKey,
        );
      if (cached) {
        console.log(
          `[Translation Jobs] ✅ 從 Redis 取得文章內容: ${articleId}`,
        );
        return cached;
      }
    } catch (error) {
      console.warn("[Translation Jobs] ⚠️ Redis 讀取失敗，查詢資料庫");
    }
  }

  // Redis 沒有或不可用，查詢資料庫
  const { data: article, error } = await supabase
    .from("generated_articles")
    .select(
      `
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
    `,
    )
    .eq("id", articleId)
    .single();

  if (error || !article) {
    console.error(`[Translation Jobs] ❌ 查詢文章失敗: ${articleId}`, error);
    return null;
  }

  // 存入 Redis（10 分鐘 TTL）
  if (isRedisAvailable()) {
    try {
      await cacheSet(cacheKey, article, 600);
      console.log(`[Translation Jobs] 💾 文章內容已快取: ${articleId}`);
    } catch {
      // 快取失敗不影響主流程
    }
  }

  return article as TranslationJobWithSource["generated_articles"];
}

async function main() {
  console.log("[Translation Jobs] 🚀 啟動翻譯任務處理器");

  // 檢查必要的環境變數（支援兩種命名方式）
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[Translation Jobs] ❌ 缺少必要的環境變數");
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // ========== 🔧 優化：先檢查 Redis flag ==========
  let shouldQueryDb = true;
  if (isRedisAvailable()) {
    try {
      const hasPendingJobs = await cacheGet<boolean>(
        CACHE_KEY_PENDING_TRANSLATION,
      );
      if (hasPendingJobs === false) {
        console.log(
          "[Translation Jobs] ✅ Redis 顯示沒有待處理翻譯任務，跳過查詢",
        );
        shouldQueryDb = false;
      }
      // hasPendingJobs === null (key 不存在) → 保守處理，查詢資料庫
    } catch (error) {
      console.warn(
        "[Translation Jobs] ⚠️ Redis 檢查失敗，fallback 到資料庫查詢",
      );
    }
  }

  // 防呆：每 30 分鐘強制檢查一次資料庫
  if (!shouldQueryDb) {
    const currentMinute = new Date().getMinutes();
    if (currentMinute % 30 === 0) {
      console.log("[Translation Jobs] 🔄 定期強制檢查資料庫");
      shouldQueryDb = true;
    }
  }

  if (!shouldQueryDb) {
    return;
  }

  console.log("[Translation Jobs] 🔍 查詢待處理翻譯任務...");

  // ========== 🔧 優化：第一階段 - 只查詢任務列表（不含文章內容） ==========
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: jobs, error } = await supabase
    .from("translation_jobs")
    .select(
      `
      id,
      source_article_id,
      target_languages,
      completed_languages,
      failed_languages,
      status,
      started_at,
      created_at,
      company_id,
      website_id,
      user_id,
      progress,
      current_language
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
    // 更新 Redis flag：確定沒有任務
    if (isRedisAvailable()) {
      await cacheSet(CACHE_KEY_PENDING_TRANSLATION, false, 300).catch(() => {});
    }
    return;
  }

  console.log(`[Translation Jobs] 🔄 發現 ${jobs.length} 個翻譯任務`);

  // ========== 🔧 優化：第二階段 - 對每個任務單獨取得文章內容 ==========
  for (const job of jobs) {
    // 取得文章內容（優先從 Redis 快取）
    const sourceArticle = await getArticleContent(
      supabase,
      job.source_article_id,
    );

    if (!sourceArticle) {
      console.error(
        `[Translation Jobs] ❌ 找不到來源文章 ${job.source_article_id}`,
      );
      await markJobFailed(supabase, job.id, "Source article not found");
      continue;
    }

    // 組合成完整的 job 物件
    const fullJob: TranslationJobWithSource = {
      ...job,
      generated_articles: sourceArticle,
    } as TranslationJobWithSource;

    await processTranslationJob(supabase, fullJob, fiveMinutesAgo);
  }

  // 處理完畢後，檢查是否還有待處理任務
  const { count: remainingCount } = await supabase
    .from("translation_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending"]);

  if (isRedisAvailable()) {
    if (remainingCount === 0) {
      await cacheDelete(CACHE_KEY_PENDING_TRANSLATION).catch(() => {});
    } else {
      // 還有任務，刷新 TTL
      await cacheSet(CACHE_KEY_PENDING_TRANSLATION, true, 300).catch(() => {});
    }
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

  // 驗證鎖定（只查詢必要欄位）
  const { data: locked } = await supabase
    .from("translation_jobs")
    .select("id")
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

  // 計算下一個黃金時段作為排程發布時間
  const scheduledPublishAt = getNextGoldenSlotISO();

  console.log(
    `[Translation Jobs] 📅 翻譯完成，排程發布時間: ${scheduledPublishAt}`,
  );

  // 儲存翻譯結果（排程到下一個黃金時段發布）
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
        // 排程發布：翻譯完成後排到下一個黃金時段
        status: "draft",
        scheduled_publish_at: scheduledPublishAt,
        auto_publish: true,
        publish_website_id: job.website_id,
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
