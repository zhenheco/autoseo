#!/usr/bin/env tsx

/**
 * 發佈已排程的文章到 WordPress
 * 由 GitHub Actions 每小時執行
 */

import { createClient } from "@supabase/supabase-js";
import { WordPressClient } from "../src/lib/wordpress/client";
import type { Database } from "../src/types/database.types";

const MAX_RETRIES = 3;

interface ScheduledArticle {
  id: string;
  title: string;
  html_content: string | null;
  slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  focus_keyword: string | null;
  featured_image_url: string | null;
  og_image: string | null;
  categories: string[] | null;
  tags: string[] | null;
  target_wordpress_status: string | null;
  publish_retry_count: number | null;
  published_to_website_id: string | null;
}

interface WebsiteConfig {
  id: string;
  wordpress_url: string;
  wp_username: string | null;
  wp_app_password: string | null;
  wp_enabled: boolean | null;
}

async function main() {
  console.log("[Publish] 🚀 開始處理排程發佈...");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  // 查詢待發佈的文章
  const now = new Date().toISOString();
  console.log(`[Publish] 🔍 查詢排程時間 <= ${now} 的文章...`);

  const { data: articles, error: articlesError } = await supabase
    .from("generated_articles")
    .select(
      `
      id,
      title,
      html_content,
      slug,
      seo_title,
      seo_description,
      focus_keyword,
      featured_image_url,
      og_image,
      categories,
      tags,
      target_wordpress_status,
      publish_retry_count,
      published_to_website_id
    `,
    )
    .eq("status", "scheduled")
    .is("wordpress_post_id", null)
    .lte("scheduled_publish_at", now)
    .lt("publish_retry_count", MAX_RETRIES)
    .order("scheduled_publish_at", { ascending: true })
    .limit(50);

  if (articlesError) {
    console.error("[Publish] ❌ 查詢文章失敗:", articlesError);
    process.exit(1);
  }

  if (!articles || articles.length === 0) {
    console.log("[Publish] ✅ 沒有待發佈的文章");
    return;
  }

  console.log(`[Publish] 📝 發現 ${articles.length} 篇待發佈文章`);

  // 收集所有需要的網站 ID
  const websiteIds = [
    ...new Set(
      (articles as ScheduledArticle[])
        .map((a) => a.published_to_website_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  if (websiteIds.length === 0) {
    console.log("[Publish] ⚠️ 沒有文章指定目標網站");
    return;
  }

  // 查詢網站設定
  const { data: websites, error: websitesError } = await supabase
    .from("website_configs")
    .select("id, wordpress_url, wp_username, wp_app_password, wp_enabled")
    .in("id", websiteIds);

  if (websitesError) {
    console.error("[Publish] ❌ 查詢網站設定失敗:", websitesError);
    process.exit(1);
  }

  const websiteMap = new Map<string, WebsiteConfig>(
    (websites || []).map((w) => [w.id, w as WebsiteConfig]),
  );

  // 處理每篇文章
  let successCount = 0;
  let failedCount = 0;

  for (const article of articles as ScheduledArticle[]) {
    const websiteId = article.published_to_website_id;
    if (!websiteId) {
      console.log(`[Publish] ⚠️ 文章 ${article.id} 沒有指定目標網站，跳過`);
      continue;
    }

    const website = websiteMap.get(websiteId);
    if (!website) {
      console.log(
        `[Publish] ⚠️ 找不到網站 ${websiteId}，跳過文章 ${article.id}`,
      );
      await markArticleFailed(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "找不到目標網站設定",
      );
      failedCount++;
      continue;
    }

    if (!website.wp_enabled) {
      console.log(
        `[Publish] ⚠️ 網站 ${websiteId} WordPress 發佈未啟用，跳過文章 ${article.id}`,
      );
      await markArticleFailed(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "WordPress 發佈功能未啟用",
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
        `[Publish] ⚠️ 網站 ${websiteId} WordPress 設定不完整，跳過文章 ${article.id}`,
      );
      await markArticleFailed(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "WordPress 設定不完整",
      );
      failedCount++;
      continue;
    }

    try {
      console.log(`[Publish] 📤 發佈文章: ${article.title}`);

      const wpClient = new WordPressClient({
        url: website.wordpress_url,
        username: website.wp_username,
        applicationPassword: website.wp_app_password,
      });

      const status = (
        article.target_wordpress_status === "draft" ? "draft" : "publish"
      ) as "draft" | "publish";

      const result = await wpClient.publishArticle(
        {
          title: article.title,
          content: article.html_content || "",
          slug: article.slug || undefined,
          seoTitle: article.seo_title || undefined,
          seoDescription: article.seo_description || undefined,
          focusKeyword: article.focus_keyword || undefined,
          featuredImageUrl:
            article.og_image || article.featured_image_url || undefined,
          categories: article.categories || undefined,
          tags: article.tags || undefined,
        },
        status,
      );

      // 更新文章狀態
      const { error: updateError } = await supabase
        .from("generated_articles")
        .update({
          wordpress_post_id: String(result.post.id),
          wordpress_post_url: result.post.link,
          status: "published",
          published_at: new Date().toISOString(),
          last_publish_error: null,
        })
        .eq("id", article.id);

      if (updateError) {
        console.error(
          `[Publish] ⚠️ 更新文章狀態失敗 ${article.id}:`,
          updateError,
        );
      }

      console.log(`[Publish] ✅ 文章發佈成功: ${result.post.link}`);
      successCount++;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`[Publish] ❌ 發佈文章失敗 ${article.id}:`, errorMessage);
      await markArticleFailed(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        errorMessage,
      );
      failedCount++;
    }
  }

  console.log(
    `[Publish] 📊 處理結果：${successCount} 成功，${failedCount} 失敗`,
  );
  console.log("[Publish] 🎉 排程發佈處理完成");
}

async function markArticleFailed(
  supabase: ReturnType<typeof createClient<Database>>,
  articleId: string,
  currentRetryCount: number,
  errorMessage: string,
) {
  const newRetryCount = currentRetryCount + 1;
  const status = newRetryCount >= MAX_RETRIES ? "publish_failed" : "scheduled";

  await supabase
    .from("generated_articles")
    .update({
      publish_retry_count: newRetryCount,
      last_publish_error: errorMessage,
      status: status,
    })
    .eq("id", articleId);

  if (newRetryCount >= MAX_RETRIES) {
    console.log(
      `[Publish] ⚠️ 文章 ${articleId} 已達最大重試次數，標記為發佈失敗`,
    );
  }
}

main().catch((err) => {
  console.error("[Publish] ❌ Fatal error:", err);
  process.exit(1);
});
