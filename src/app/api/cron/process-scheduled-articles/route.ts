import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/server";
import { WordPressClient } from "@/lib/wordpress/client";
import {
  decryptWordPressPassword,
  isEncrypted,
} from "@/lib/security/token-encryption";
import { pingAllSearchEngines } from "@/lib/sitemap/ping-service";
import {
  cacheSet,
  isRedisAvailable,
  CACHE_CONFIG,
} from "@/lib/cache/redis-cache";

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
        is_active,
        is_platform_blog,
        auto_translate_enabled,
        auto_translate_languages
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

    // Platform Blog 不需要 WordPress，直接更新資料庫即可
    const isPlatformBlog = website.is_platform_blog === true;

    // 檢查網站是否啟用（Platform Blog 只需檢查 is_active）
    if (!website.is_active) {
      await handlePublishError(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "網站已停用",
      );
      results.failed++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "failed",
        error: "網站已停用",
      });
      continue;
    }

    // 非 Platform Blog 需要檢查 WordPress 功能
    if (!isPlatformBlog && !website.wp_enabled) {
      await handlePublishError(
        supabase,
        article.id,
        article.publish_retry_count || 0,
        "WordPress 功能未啟用",
      );
      results.failed++;
      results.details.push({
        articleId: article.id,
        title: article.article_title,
        status: "failed",
        error: "WordPress 功能未啟用",
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

    // 情況 0：Platform Blog → 直接更新資料庫，不需要 WordPress
    if (isPlatformBlog) {
      console.log(
        `[Process Scheduled Articles] Publishing to Platform Blog: ${article.id} - ${generatedArticle.title}`,
      );

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
          .eq("id", article.id);

        // 更新 generated_articles（發布到 Platform Blog）
        await supabase
          .from("generated_articles")
          .update({
            status: "published",
            published_at: publishedAt,
            published_to_website_id: website.id,
            published_to_website_at: publishedAt,
          })
          .eq("id", generatedArticle.id);

        console.log(
          `[Process Scheduled Articles] Published to Platform Blog: ${article.id} - ${generatedArticle.title}`,
        );

        // 觸發自動翻譯
        await triggerAutoTranslation(
          supabase,
          generatedArticle.id,
          website.id,
          article.company_id,
          article.user_id,
          website.auto_translate_enabled,
          website.auto_translate_languages
        );

        results.published++;
        results.details.push({
          articleId: article.id,
          title: generatedArticle.title,
          status: "published",
        });
        continue;
      } catch (platformError) {
        const errorMessage =
          platformError instanceof Error
            ? platformError.message
            : "Platform Blog 發布失敗";
        console.error(
          `[Process Scheduled Articles] Platform Blog publish error: ${article.id}`,
          platformError,
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
            title: generatedArticle.title,
            status: "retried",
            error: errorMessage,
          });
        } else {
          results.failed++;
          results.details.push({
            articleId: article.id,
            title: generatedArticle.title,
            status: "failed",
            error: errorMessage,
          });
        }
        continue;
      }
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
        // 解密 WordPress 密碼（支援舊資料的明文格式）
        const wpPassword = website.wp_app_password
          ? isEncrypted(website.wp_app_password)
            ? decryptWordPressPassword(website.wp_app_password)
            : website.wp_app_password
          : "";

        const wordpressClient = new WordPressClient({
          url: website.wordpress_url,
          username: website.wp_username || "",
          applicationPassword: wpPassword,
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

        // 觸發自動翻譯
        await triggerAutoTranslation(
          supabase,
          generatedArticle.id,
          website.id,
          article.company_id,
          article.user_id,
          website.auto_translate_enabled,
          website.auto_translate_languages
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
      // 解密 WordPress 密碼（支援舊資料的明文格式）
      const wpPasswordForNew = website.wp_app_password
        ? isEncrypted(website.wp_app_password)
          ? decryptWordPressPassword(website.wp_app_password)
          : website.wp_app_password
        : "";

      const wordpressClient = new WordPressClient({
        url: website.wordpress_url,
        username: website.wp_username || "",
        applicationPassword: wpPasswordForNew,
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

      // 觸發自動翻譯
      await triggerAutoTranslation(
        supabase,
        generatedArticle.id,
        website.id,
        article.company_id,
        article.user_id,
        website.auto_translate_enabled,
        website.auto_translate_languages
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

  // 同時處理排程的翻譯版本發布
  const translationResults = await processScheduledTranslations(supabase);

  // 如果有任何文章或翻譯成功發布，觸發 sitemap 更新和搜尋引擎 ping
  const totalPublished =
    results.published + (translationResults.published || 0);
  if (totalPublished > 0) {
    try {
      revalidatePath("/sitemap.xml");
      revalidatePath("/post-sitemap.xml");
      revalidatePath("/category-sitemap.xml");
      revalidatePath("/tag-sitemap.xml");
      console.log("[Process Scheduled Articles] Sitemap revalidated");

      // Ping 搜尋引擎（非同步，不阻塞返回）
      pingAllSearchEngines().catch((error) => {
        console.error("[Process Scheduled Articles] Sitemap ping 失敗:", error);
      });
    } catch (error) {
      console.error(
        "[Process Scheduled Articles] Sitemap revalidate 失敗:",
        error,
      );
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
    translations: translationResults,
    completedAt: new Date().toISOString(),
  });
}

/**
 * 處理排程的翻譯版本發布
 * 翻譯版本發布到 Platform Blog 只需更新資料庫
 */
async function processScheduledTranslations(
  supabase: ReturnType<typeof createAdminClient>,
) {
  const now = new Date().toISOString();

  console.log("[Process Scheduled Translations] Starting...");

  // 查詢待發布的翻譯（到達排程時間且 auto_publish = true）
  const { data: translations, error: fetchError } = await supabase
    .from("article_translations")
    .select(
      `
      id,
      source_article_id,
      target_language,
      title,
      slug,
      status,
      scheduled_publish_at,
      publish_website_id
    `,
    )
    .in("status", ["draft", "reviewed"])
    .lte("scheduled_publish_at", now)
    .eq("auto_publish", true)
    .order("scheduled_publish_at", { ascending: true })
    .limit(20);

  if (fetchError) {
    console.error("[Process Scheduled Translations] Fetch error:", fetchError);
    return { processed: 0, published: 0, failed: 0, error: fetchError.message };
  }

  if (!translations || translations.length === 0) {
    console.log("[Process Scheduled Translations] No translations to process");
    return { processed: 0, published: 0, failed: 0 };
  }

  console.log(
    `[Process Scheduled Translations] Found ${translations.length} translations to process`,
  );

  const results = {
    processed: 0,
    published: 0,
    failed: 0,
    details: [] as Array<{
      translationId: string;
      language: string;
      title: string;
      status: "published" | "failed";
      error?: string;
    }>,
  };

  for (const translation of translations) {
    results.processed++;

    try {
      const publishedAt = new Date().toISOString();

      // 翻譯版本發布只需更新狀態
      const { error: updateError } = await supabase
        .from("article_translations")
        .update({
          status: "published",
          published_at: publishedAt,
          auto_publish: false, // 發布後關閉自動發布
        })
        .eq("id", translation.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      console.log(
        `[Process Scheduled Translations] Published: ${translation.id} (${translation.target_language}) - ${translation.title}`,
      );
      results.published++;
      results.details.push({
        translationId: translation.id,
        language: translation.target_language,
        title: translation.title,
        status: "published",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "發布失敗";
      console.error(
        `[Process Scheduled Translations] Error publishing ${translation.id}:`,
        error,
      );
      results.failed++;
      results.details.push({
        translationId: translation.id,
        language: translation.target_language,
        title: translation.title,
        status: "failed",
        error: errorMessage,
      });
    }
  }

  console.log(
    `[Process Scheduled Translations] Completed: ${results.published} published, ${results.failed} failed`,
  );

  return results;
}

/**
 * 文章發布成功後觸發自動翻譯
 * 檢查網站的自動翻譯設定，如果啟用則建立翻譯任務
 */
async function triggerAutoTranslation(
  supabase: ReturnType<typeof createAdminClient>,
  articleId: string,
  websiteId: string,
  companyId: string,
  userId: string,
  autoTranslateEnabled: boolean | null,
  autoTranslateLanguages: string[] | null
): Promise<{ triggered: boolean; jobCount: number; skipped: number }> {
  // 檢查是否啟用自動翻譯
  if (!autoTranslateEnabled || !autoTranslateLanguages || autoTranslateLanguages.length === 0) {
    return { triggered: false, jobCount: 0, skipped: 0 };
  }

  console.log(
    `[Auto Translate] Checking article ${articleId} for auto translation to: ${autoTranslateLanguages.join(", ")}`
  );

  try {
    // 查詢已有翻譯，避免重複翻譯
    const { data: existingTranslations } = await supabase
      .from("article_translations")
      .select("target_language")
      .eq("source_article_id", articleId);

    // 建立已翻譯的 Set
    const existingSet = new Set(
      existingTranslations?.map((t) => t.target_language) || []
    );

    // 過濾掉已有翻譯的語言
    const languagesToTranslate = autoTranslateLanguages.filter(
      (lang) => !existingSet.has(lang)
    );

    const skippedCount = autoTranslateLanguages.length - languagesToTranslate.length;

    if (languagesToTranslate.length === 0) {
      console.log(
        `[Auto Translate] All languages already translated for article ${articleId}, skipped ${skippedCount}`
      );
      return { triggered: false, jobCount: 0, skipped: skippedCount };
    }

    // 建立翻譯任務
    const job = {
      id: uuidv4(),
      job_id: `auto-trans-${articleId.slice(0, 8)}-${Date.now()}`,
      company_id: companyId,
      website_id: websiteId,
      user_id: userId,
      source_article_id: articleId,
      target_languages: languagesToTranslate,
      status: "pending",
      progress: 0,
      completed_languages: [],
      failed_languages: {},
    };

    const { error: insertError } = await supabase
      .from("translation_jobs")
      .insert([job]);

    if (insertError) {
      console.error("[Auto Translate] Failed to create translation job:", insertError);
      return { triggered: false, jobCount: 0, skipped: skippedCount };
    }

    console.log(
      `[Auto Translate] Created translation job for article ${articleId}: ${languagesToTranslate.join(", ")}`
    );

    // 設置 Redis flag 通知有待處理翻譯任務
    if (isRedisAvailable()) {
      await cacheSet(
        CACHE_CONFIG.PENDING_TRANSLATION_JOBS.prefix,
        true,
        CACHE_CONFIG.PENDING_TRANSLATION_JOBS.ttl
      ).catch((err) => {
        console.warn("[Auto Translate] Redis flag 設置失敗:", err);
      });
    }

    // 觸發 GitHub Actions 立即處理翻譯任務
    if (process.env.GH_PAT && process.env.GH_REPO) {
      try {
        await fetch(
          `https://api.github.com/repos/${process.env.GH_REPO}/dispatches`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GH_PAT}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "translation-jobs-created",
            }),
          }
        );
        console.log("[Auto Translate] GitHub Actions 已觸發");
      } catch (e) {
        console.warn("[Auto Translate] GitHub dispatch 失敗:", e);
      }
    }

    return { triggered: true, jobCount: 1, skipped: skippedCount };
  } catch (error) {
    console.error("[Auto Translate] Error:", error);
    return { triggered: false, jobCount: 0, skipped: 0 };
  }
}

async function handlePublishError(
  supabase: ReturnType<typeof createAdminClient>,
  articleId: string,
  currentRetryCount: number,
  errorMessage: string,
): Promise<boolean> {
  const newRetryCount = currentRetryCount + 1;

  if (newRetryCount >= MAX_RETRY_COUNT) {
    // 達到最大重試次數後，重置計數並延後 2 小時自動重新排程
    const autoRescheduleTime = new Date();
    autoRescheduleTime.setHours(autoRescheduleTime.getHours() + 2);

    await supabase
      .from("article_jobs")
      .update({
        status: "scheduled", // 保持 scheduled 狀態以便自動重試
        scheduled_publish_at: autoRescheduleTime.toISOString(),
        last_publish_error: `${errorMessage} (已重試 ${newRetryCount} 次，自動重新排程)`,
        publish_retry_count: 0, // 重置重試計數
      })
      .eq("id", articleId);

    console.log(
      `[Process Scheduled Articles] Max retries reached for ${articleId}, auto-rescheduled to ${autoRescheduleTime.toISOString()}`,
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
