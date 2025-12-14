import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { WordPressClient } from "@/lib/wordpress/client";

const MAX_RETRY_COUNT = 3;
const RETRY_DELAYS_MINUTES = [5, 30, 120];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  console.log("[Process Scheduled Articles] Starting...");

  const { data: articles, error: fetchError } = await supabase
    .from("article_jobs")
    .select(
      `
      *,
      website_configs (
        id,
        website_name,
        wordpress_url,
        wp_username,
        wp_app_password,
        wp_enabled,
        wordpress_access_token,
        wordpress_refresh_token,
        is_active
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
    .limit(10);

  if (fetchError) {
    console.error("[Process Scheduled Articles] Fetch error:", fetchError);
    return NextResponse.json(
      { error: "Failed to fetch scheduled articles" },
      { status: 500 },
    );
  }

  if (!articles || articles.length === 0) {
    console.log("[Process Scheduled Articles] No articles to process");
    return NextResponse.json({
      success: true,
      processed: 0,
      message: "No scheduled articles to process",
    });
  }

  console.log(
    `[Process Scheduled Articles] Found ${articles.length} articles to process`,
  );

  const results = {
    processed: 0,
    published: 0,
    failed: 0,
    retried: 0,
    details: [] as Array<{
      articleId: string;
      title: string | null;
      status: "published" | "failed" | "retried";
      error?: string;
    }>,
  };

  for (const article of articles) {
    results.processed++;
    const website = article.website_configs;
    const generatedArticle = article.generated_articles;

    if (!website) {
      await handlePublishError(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "網站配置不存在",
      );
      results.failed++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "failed",
        error: "網站配置不存在",
      });
      continue;
    }

    if (!website.is_active || !website.wp_enabled) {
      await handlePublishError(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "網站已停用或 WordPress 功能未啟用",
      );
      results.failed++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "failed",
        error: "網站已停用或 WordPress 功能未啟用",
      });
      continue;
    }

    if (!generatedArticle) {
      await handlePublishError(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "找不到文章內容",
      );
      results.failed++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "failed",
        error: "找不到文章內容",
      });
      continue;
    }

    // 情況 1：已有 WordPress 草稿 → 更新為已發布（處理歷史草稿）
    if (
      generatedArticle.wordpress_post_id &&
      generatedArticle.wordpress_status === "draft"
    ) {
      console.log(
        `[Process Scheduled Articles] Updating draft to publish: ${article.id} (post_id: ${generatedArticle.wordpress_post_id})`,
      );

      try {
        const wordpressClient = new WordPressClient({
          url: website.wordpress_url,
          username: website.wp_username || "",
          applicationPassword: website.wp_app_password || "",
          accessToken: website.wordpress_access_token || undefined,
          refreshToken: website.wordpress_refresh_token || undefined,
        });

        // 使用現有的 updatePost 方法更新狀態為已發布
        await wordpressClient.updatePost(generatedArticle.wordpress_post_id, {
          status: "publish",
        });

        const publishedAt = new Date().toISOString();

        // 更新 article_jobs
        await supabase
          .from("article_jobs")
          .update({
            status: "published",
            published_at: publishedAt,
            wordpress_post_id: generatedArticle.wordpress_post_id?.toString(),
            publish_retry_count: 0,
            last_publish_error: null,
          })
          .eq("id", article.id);

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
          .eq("id", generatedArticle.id);

        console.log(
          `[Process Scheduled Articles] Draft updated to publish: ${article.id} - ${article.article_title}`,
        );
        results.published++;
        results.details.push({
          articleId: article.id,
          title: article.article_title,
          status: "published",
        });
        continue;
      } catch (wpError) {
        const errorMessage =
          wpError instanceof Error ? wpError.message : "更新草稿失敗";
        console.error(
          `[Process Scheduled Articles] Failed to update draft: ${article.id}`,
          wpError,
        );

        // 記錄錯誤，設置重試
        const retryCount = article.publish_retry_count || 0;
        const wasRetried = await handlePublishError(
          supabase,
          article.id,
          retryCount,
          `更新草稿為已發布失敗: ${errorMessage}`,
        );

        if (wasRetried) {
          results.retried++;
          results.details.push({
            articleId: article.id,
            title: article.article_title,
            status: "retried",
            error: errorMessage,
          });
        } else {
          results.failed++;
          results.details.push({
            articleId: article.id,
            title: article.article_title,
            status: "failed",
            error: errorMessage,
          });
        }
        continue;
      }
    }

    // 情況 2：已發布的文章（防重複發布）
    if (
      generatedArticle.wordpress_post_id &&
      generatedArticle.wordpress_status === "publish"
    ) {
      console.log(
        `[Process Scheduled Articles] Already published to WordPress (post_id: ${generatedArticle.wordpress_post_id}), updating status: ${article.id}`,
      );
      // 同步更新 article_jobs 狀態
      await supabase
        .from("article_jobs")
        .update({
          status: "published",
          wordpress_post_id: generatedArticle.wordpress_post_id?.toString(),
        })
        .eq("id", article.id);
      results.published++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "published",
      });
      continue;
    }

    // 情況 3：沒有 wordpress_post_id → 新發布（方案 B：未來新文章）

    try {
      const wordpressClient = new WordPressClient({
        url: website.wordpress_url,
        username: website.wp_username || "",
        applicationPassword: website.wp_app_password || "",
        accessToken: website.wordpress_access_token || undefined,
        refreshToken: website.wordpress_refresh_token || undefined,
      });

      const publishResult = await wordpressClient.publishArticle(
        {
          title: generatedArticle.seo_title || generatedArticle.title,
          content: generatedArticle.html_content || "",
          excerpt: generatedArticle.seo_description || "",
          slug: generatedArticle.slug || "",
          featuredImageUrl: generatedArticle.og_image || undefined,
          categories: generatedArticle.categories || [],
          tags: generatedArticle.tags || [],
          seoTitle: generatedArticle.seo_title || generatedArticle.title,
          seoDescription: generatedArticle.seo_description || "",
          focusKeyword: generatedArticle.focus_keyword || "",
        },
        "publish",
      );

      const publishedAt = new Date().toISOString();

      await supabase
        .from("article_jobs")
        .update({
          status: "published",
          published_at: publishedAt,
          wordpress_post_id: publishResult.post.id?.toString(),
          publish_retry_count: 0,
          last_publish_error: null,
        })
        .eq("id", article.id);

      await supabase
        .from("generated_articles")
        .update({
          wordpress_post_id: publishResult.post.id,
          wordpress_post_url: publishResult.post.link,
          wordpress_status: publishResult.post.status,
          published_at: publishedAt,
          status: "published",
          published_to_website_id: website.id,
          published_to_website_at: publishedAt,
        })
        .eq("id", generatedArticle.id);

      console.log(
        `[Process Scheduled Articles] Published: ${article.id} - ${article.article_title}`,
      );
      results.published++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "published",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "發布失敗";
      console.error(
        `[Process Scheduled Articles] Error publishing ${article.id}:`,
        error,
      );

      const retryCount = article.publish_retry_count || 0;
      const wasRetried = await handlePublishError(
        supabase,
        article.id,
        retryCount,
        errorMessage,
      );

      if (wasRetried) {
        results.retried++;
        results.details.push({
          articleId: article.id,
          title: article.article_title,
          status: "retried",
          error: errorMessage,
        });
      } else {
        results.failed++;
        results.details.push({
          articleId: article.id,
          title: article.article_title,
          status: "failed",
          error: errorMessage,
        });
      }
    }
  }

  console.log(
    `[Process Scheduled Articles] Completed: ${results.published} published, ${results.retried} retried, ${results.failed} failed`,
  );

  return NextResponse.json({
    success: true,
    ...results,
    completedAt: new Date().toISOString(),
  });
}

async function handlePublishError(
  supabase: ReturnType<typeof createAdminClient>,
  articleId: string,
  currentRetryCount: number,
  errorMessage: string,
): Promise<boolean> {
  const newRetryCount = currentRetryCount + 1;

  if (newRetryCount >= MAX_RETRY_COUNT) {
    await supabase
      .from("article_jobs")
      .update({
        status: "schedule_failed",
        last_publish_error: errorMessage,
        publish_retry_count: newRetryCount,
      })
      .eq("id", articleId);

    console.log(
      `[Process Scheduled Articles] Max retries reached for ${articleId}, marked as schedule_failed`,
    );
    return false;
  }

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
    .eq("id", articleId);

  console.log(
    `[Process Scheduled Articles] Scheduled retry for ${articleId} at ${nextRetryTime.toISOString()} (attempt ${newRetryCount})`,
  );
  return true;
}
