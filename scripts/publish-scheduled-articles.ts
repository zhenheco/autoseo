#!/usr/bin/env tsx

/**
 * 發佈已排程的文章到 WordPress 或 Platform Blog
 * 由 GitHub Actions 每小時執行
 *
 * 重要修復（2025-12-30）：
 * - 從查詢 generated_articles 改為查詢 article_jobs
 * - 這是因為排程資料存儲在 article_jobs 表，而非 generated_articles
 */

import { createClient } from "@supabase/supabase-js";
import { WordPressClient } from "../src/lib/wordpress/client";
import type { Database } from "../src/types/database.types";

const MAX_RETRIES = 3;
const RETRY_DELAYS_MINUTES = [5, 30, 120];

interface ArticleJob {
  id: string;
  status: string;
  scheduled_publish_at: string | null;
  auto_publish: boolean | null;
  publish_retry_count: number | null;
  last_publish_error: string | null;
  website_id: string | null;
  website_configs: {
    id: string;
    website_name: string | null;
    wordpress_url: string;
    wp_username: string | null;
    wp_app_password: string | null;
    wp_enabled: boolean | null;
    is_active: boolean | null;
    is_platform_blog: boolean | null;
  } | null;
  generated_articles: {
    id: string;
    title: string;
    html_content: string | null;
    seo_title: string | null;
    seo_description: string | null;
    slug: string | null;
    og_image: string | null;
    categories: string[] | null;
    tags: string[] | null;
    focus_keyword: string | null;
    wordpress_post_id: number | null;
    wordpress_status: string | null;
  } | null;
}

async function main() {
  console.log("[Publish] 🚀 開始處理排程發佈...");

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[Publish] ❌ 缺少環境變數 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const now = new Date().toISOString();
  console.log(`[Publish] 🔍 查詢排程時間 <= ${now} 的文章...`);

  // 核心修復：查詢 article_jobs 而非 generated_articles
  const { data: jobs, error: fetchError } = await supabase
    .from("article_jobs")
    .select(
      `
      id,
      status,
      scheduled_publish_at,
      auto_publish,
      publish_retry_count,
      last_publish_error,
      website_id,
      website_configs (
        id,
        website_name,
        wordpress_url,
        wp_username,
        wp_app_password,
        wp_enabled,
        is_active,
        is_platform_blog
      ),
      generated_articles (
        id,
        title,
        html_content,
        seo_title,
        seo_description,
        slug,
        og_image,
        categories,
        tags,
        focus_keyword,
        wordpress_post_id,
        wordpress_status
      )
    `,
    )
    .eq("status", "scheduled")
    .lte("scheduled_publish_at", now)
    .eq("auto_publish", true)
    .order("scheduled_publish_at", { ascending: true })
    .limit(50);

  if (fetchError) {
    console.error("[Publish] ❌ 查詢文章失敗:", fetchError);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("[Publish] ✅ 沒有待發佈的文章");
    return;
  }

  console.log(`[Publish] 📝 發現 ${jobs.length} 篇待發佈文章`);

  let successCount = 0;
  let failedCount = 0;
  let retriedCount = 0;

  for (const job of jobs as unknown as ArticleJob[]) {
    const website = job.website_configs;
    const article = job.generated_articles;

    // 驗證網站配置
    if (!website) {
      console.log(`[Publish] ⚠️ 文章 ${job.id} 找不到網站配置，跳過`);
      await handlePublishError(
        supabase,
        job.id,
        job.publish_retry_count || 0,
        "網站配置不存在",
      );
      failedCount++;
      continue;
    }

    if (!website.is_active) {
      console.log(`[Publish] ⚠️ 網站 ${website.website_name} 已停用，跳過`);
      await handlePublishError(
        supabase,
        job.id,
        job.publish_retry_count || 0,
        "網站已停用",
      );
      failedCount++;
      continue;
    }

    if (!article) {
      console.log(`[Publish] ⚠️ 文章 ${job.id} 找不到文章內容，跳過`);
      await handlePublishError(
        supabase,
        job.id,
        job.publish_retry_count || 0,
        "找不到文章內容",
      );
      failedCount++;
      continue;
    }

    const isPlatformBlog = website.is_platform_blog === true;

    // 處理 Platform Blog
    if (isPlatformBlog) {
      console.log(`[Publish] 📤 發佈到 Platform Blog: ${article.title}`);
      try {
        const publishedAt = new Date().toISOString();

        // 更新 article_jobs
        await supabase
          .from("article_jobs")
          .update({
            status: "published",
            published_at: publishedAt,
            publish_retry_count: 0,
            last_publish_error: null,
          })
          .eq("id", job.id);

        // 更新 generated_articles
        await supabase
          .from("generated_articles")
          .update({
            status: "published",
            published_at: publishedAt,
            published_to_website_id: website.id,
            published_to_website_at: publishedAt,
          })
          .eq("id", article.id);

        console.log(`[Publish] ✅ Platform Blog 發佈成功: ${article.title}`);
        successCount++;
        continue;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Platform Blog 發布失敗";
        console.error(`[Publish] ❌ Platform Blog 發佈失敗 ${job.id}:`, error);
        const wasRetried = await handlePublishError(
          supabase,
          job.id,
          job.publish_retry_count || 0,
          errorMessage,
        );
        if (wasRetried) retriedCount++;
        else failedCount++;
        continue;
      }
    }

    // 處理 WordPress
    if (!website.wp_enabled) {
      console.log(
        `[Publish] ⚠️ 網站 ${website.website_name} WordPress 未啟用，跳過`,
      );
      await handlePublishError(
        supabase,
        job.id,
        job.publish_retry_count || 0,
        "WordPress 功能未啟用",
      );
      failedCount++;
      continue;
    }

    if (
      !website.wordpress_url ||
      !website.wp_username ||
      !website.wp_app_password
    ) {
      console.log(
        `[Publish] ⚠️ 網站 ${website.website_name} WordPress 設定不完整，跳過`,
      );
      await handlePublishError(
        supabase,
        job.id,
        job.publish_retry_count || 0,
        "WordPress 設定不完整",
      );
      failedCount++;
      continue;
    }

    try {
      console.log(`[Publish] 📤 發佈到 WordPress: ${article.title}`);

      const wpClient = new WordPressClient({
        url: website.wordpress_url,
        username: website.wp_username,
        applicationPassword: website.wp_app_password,
      });

      // 如果已有 WordPress 草稿，更新狀態
      if (article.wordpress_post_id && article.wordpress_status === "draft") {
        console.log(
          `[Publish] 📝 更新現有草稿 (post_id: ${article.wordpress_post_id})`,
        );
        await wpClient.updatePost(article.wordpress_post_id, {
          status: "publish",
        });

        const publishedAt = new Date().toISOString();

        // 更新 article_jobs
        await supabase
          .from("article_jobs")
          .update({
            status: "published",
            published_at: publishedAt,
            wordpress_post_id: String(article.wordpress_post_id),
            publish_retry_count: 0,
            last_publish_error: null,
          })
          .eq("id", job.id);

        // 更新 generated_articles
        await supabase
          .from("generated_articles")
          .update({
            wordpress_status: "publish",
            published_at: publishedAt,
            status: "published",
            published_to_website_id: website.id,
            published_to_website_at: publishedAt,
          })
          .eq("id", article.id);

        console.log(`[Publish] ✅ 草稿更新為已發佈: ${article.title}`);
        successCount++;
        continue;
      }

      // 如果已發佈，同步狀態
      if (article.wordpress_post_id && article.wordpress_status === "publish") {
        console.log(
          `[Publish] ℹ️ 文章已發佈 (post_id: ${article.wordpress_post_id})，同步狀態`,
        );
        await supabase
          .from("article_jobs")
          .update({
            status: "published",
            wordpress_post_id: String(article.wordpress_post_id),
          })
          .eq("id", job.id);
        successCount++;
        continue;
      }

      // 新發佈
      const result = await wpClient.publishArticle(
        {
          title: article.seo_title || article.title,
          content: article.html_content || "",
          excerpt: article.seo_description || "",
          slug: article.slug || "",
          featuredImageUrl: article.og_image || undefined,
          categories: article.categories || [],
          tags: article.tags || [],
          seoTitle: article.seo_title || article.title,
          seoDescription: article.seo_description || "",
          focusKeyword: article.focus_keyword || "",
        },
        "publish",
      );

      const publishedAt = new Date().toISOString();

      // 更新 article_jobs
      await supabase
        .from("article_jobs")
        .update({
          status: "published",
          published_at: publishedAt,
          wordpress_post_id: String(result.post.id),
          publish_retry_count: 0,
          last_publish_error: null,
        })
        .eq("id", job.id);

      // 更新 generated_articles
      await supabase
        .from("generated_articles")
        .update({
          wordpress_post_id: result.post.id,
          wordpress_post_url: result.post.link,
          wordpress_status: result.post.status,
          published_at: publishedAt,
          status: "published",
          published_to_website_id: website.id,
          published_to_website_at: publishedAt,
        })
        .eq("id", article.id);

      console.log(`[Publish] ✅ 文章發佈成功: ${result.post.link}`);
      successCount++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "發布失敗";
      console.error(`[Publish] ❌ 發佈文章失敗 ${job.id}:`, errorMessage);
      const wasRetried = await handlePublishError(
        supabase,
        job.id,
        job.publish_retry_count || 0,
        errorMessage,
      );
      if (wasRetried) retriedCount++;
      else failedCount++;
    }
  }

  console.log(
    `[Publish] 📊 處理結果：${successCount} 成功，${retriedCount} 重試中，${failedCount} 失敗`,
  );
  console.log("[Publish] 🎉 排程發佈處理完成");
}

async function handlePublishError(
  supabase: ReturnType<typeof createClient<Database>>,
  jobId: string,
  currentRetryCount: number,
  errorMessage: string,
): Promise<boolean> {
  const newRetryCount = currentRetryCount + 1;

  if (newRetryCount >= MAX_RETRIES) {
    // 達到最大重試次數，自動延後 2 小時
    const autoRescheduleTime = new Date();
    autoRescheduleTime.setHours(autoRescheduleTime.getHours() + 2);

    await supabase
      .from("article_jobs")
      .update({
        status: "scheduled",
        scheduled_publish_at: autoRescheduleTime.toISOString(),
        last_publish_error: `${errorMessage} (已重試 ${newRetryCount} 次，自動重新排程)`,
        publish_retry_count: 0,
      })
      .eq("id", jobId);

    console.log(
      `[Publish] ⚠️ 文章 ${jobId} 已達最大重試次數，自動延後至 ${autoRescheduleTime.toISOString()}`,
    );
    return false;
  }

  // 設定延遲重試
  const nextRetryMinutes = RETRY_DELAYS_MINUTES[newRetryCount - 1] || 120;
  const nextRetryTime = new Date();
  nextRetryTime.setMinutes(nextRetryTime.getMinutes() + nextRetryMinutes);

  await supabase
    .from("article_jobs")
    .update({
      scheduled_publish_at: nextRetryTime.toISOString(),
      last_publish_error: errorMessage,
      publish_retry_count: newRetryCount,
    })
    .eq("id", jobId);

  console.log(
    `[Publish] ℹ️ 文章 ${jobId} 將在 ${nextRetryMinutes} 分鐘後重試 (第 ${newRetryCount} 次)`,
  );
  return true;
}

main().catch((err) => {
  console.error("[Publish] ❌ Fatal error:", err);
  process.exit(1);
});
