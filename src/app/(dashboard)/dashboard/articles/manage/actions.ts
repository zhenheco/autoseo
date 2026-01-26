"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TokenBillingService } from "@/lib/billing/token-billing-service";
import {
  cacheGetOrSet,
  articleListCacheKey,
  articleHtmlCacheKey,
  invalidateArticleListCache,
  invalidateArticleCache,
  CACHE_CONFIG,
  cacheGet,
  cacheSet,
} from "@/lib/cache/redis-cache";
import { getExtendedSlotsForCount } from "@/lib/scheduling/golden-slots";

const RESERVED_TOKENS = 4000; // 預扣額度

export interface ArticleWithWebsite {
  id: string;
  job_id: string;
  company_id: string;
  website_id: string | null;
  user_id: string;
  keywords: string[];
  status: string;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  published_at: string | null;
  scheduled_publish_at: string | null;
  website_configs: {
    id: string;
    website_name: string;
    wordpress_url: string;
  } | null;
  generated_articles: {
    id: string;
    title: string;
    /** @deprecated 列表查詢不再包含 html_content，請使用 getArticleHtml() */
    html_content?: string;
    content_json: Record<string, unknown> | null;
  } | null;
}

export interface GeneratedArticle {
  id: string;
  article_job_id: string;
  title: string;
  content: string;
  meta_description: string | null;
  status: string;
  published_to_website_id: string | null;
  published_url: string | null;
  wp_post_id: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export async function getArticles(
  filter: "all" | "unpublished" | "published" | "scheduled" = "all",
  websiteId?: string | null,
) {
  const user = await getUser();
  if (!user) return { articles: [], error: "未登入", fromCache: false };

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const companyId = membership?.company_id || user.id;

  // 使用 Redis 快取
  const cacheKey = articleListCacheKey(
    companyId,
    filter,
    websiteId || undefined,
  );

  const { data: articles, fromCache } = await cacheGetOrSet<
    ArticleWithWebsite[]
  >(cacheKey, CACHE_CONFIG.ARTICLE_LIST.ttl, async () => {
    // 查詢文章列表（不含 html_content，大幅減少資料傳輸）
    let query = supabase
      .from("article_jobs")
      .select(
        `
          *,
          website_configs (
            id,
            website_name,
            wordpress_url
          ),
          generated_articles (
            id,
            title,
            content_json
          )
        `,
      )
      .eq("company_id", companyId)
      .order("scheduled_publish_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    // 網站篩選
    if (websiteId) {
      query = query.eq("website_id", websiteId);
    }

    if (filter === "unpublished") {
      query = query.in("status", [
        "pending",
        "processing",
        "draft",
        "completed",
        "cancelled",
        "failed",
      ]);
    } else if (filter === "published") {
      query = query.eq("status", "published");
    } else if (filter === "scheduled") {
      query = query.eq("status", "scheduled");
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch articles:", error);
      throw error;
    }

    return (data || []) as ArticleWithWebsite[];
  });

  return { articles, error: null, fromCache };
}

/**
 * 取得單篇文章的 HTML 內容（帶快取）
 * @param articleJobId 文章 Job ID
 * @returns HTML 內容
 */
export async function getArticleHtml(articleJobId: string): Promise<{
  html: string | null;
  title: string | null;
  error: string | null;
  fromCache: boolean;
}> {
  const user = await getUser();
  if (!user)
    return { html: null, title: null, error: "未登入", fromCache: false };

  const supabase = await createClient();

  // 先驗證權限
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return { html: null, title: null, error: "無權限", fromCache: false };
  }

  // 使用 Redis 快取
  const cacheKey = articleHtmlCacheKey(articleJobId);

  // 先嘗試從快取獲取
  const cached = await cacheGet<{ html: string; title: string }>(cacheKey);
  if (cached) {
    return {
      html: cached.html,
      title: cached.title,
      error: null,
      fromCache: true,
    };
  }

  // 快取未命中，查詢資料庫
  const { data: article, error: dbError } = await supabase
    .from("generated_articles")
    .select("html_content, title")
    .eq("article_job_id", articleJobId)
    .single();

  // 文章不存在時返回錯誤訊息而非拋出錯誤
  if (dbError || !article) {
    return {
      html: null,
      title: null,
      error: "文章尚未生成完成或不存在",
      fromCache: false,
    };
  }

  const data = {
    html: article.html_content || "",
    title: article.title || "",
  };

  // 非同步存入快取
  cacheSet(cacheKey, data, CACHE_CONFIG.ARTICLE_HTML.ttl).catch(() => {});

  return {
    html: data.html,
    title: data.title,
    error: null,
    fromCache: false,
  };
}

export async function getGeneratedArticle(articleJobId: string) {
  const user = await getUser();
  if (!user) return { article: null, error: "未登入" };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("article_job_id", articleJobId)
    .single();

  if (error) {
    console.error("Failed to fetch generated article:", error);
    return { article: null, error: error.message };
  }

  return { article: data as GeneratedArticle, error: null };
}

export async function assignWebsiteToArticle(
  articleJobId: string,
  websiteId: string,
) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  const { error: jobError } = await supabase
    .from("article_jobs")
    .update({ website_id: websiteId })
    .eq("id", articleJobId);

  if (jobError) {
    console.error("Failed to assign website to article job:", jobError);
    return { success: false, error: jobError.message };
  }

  const { error: generatedError } = await supabase
    .from("generated_articles")
    .update({ published_to_website_id: websiteId })
    .eq("article_job_id", articleJobId);

  if (generatedError) {
    console.error("Failed to update generated article:", generatedError);
  }

  revalidatePath("/dashboard/articles/manage");
  return { success: true, error: null };
}

/**
 * 發布文章到 WordPress 或 Platform Blog
 * @param articleJobId - 文章 Job ID
 * @param websiteId - 目標網站 ID
 * @param status - 發布狀態：publish（公開）或 draft（草稿），預設為 publish
 * @param syncTargetIds - 可選：指定同步目標 ID 列表。若不傳則同步到所有啟用目標；若傳空陣列則不執行同步
 */
export async function publishArticle(
  articleJobId: string,
  websiteId: string,
  status: "publish" | "draft" = "publish",
  syncTargetIds?: string[],
) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  // 查詢文章以獲取 generated_articles 的 id
  const { data: article, error: fetchError } = await supabase
    .from("generated_articles")
    .select("id")
    .eq("article_job_id", articleJobId)
    .single();

  if (fetchError || !article) {
    return { success: false, error: "找不到文章內容" };
  }

  // 檢查網站是否為 Platform Blog
  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("is_platform_blog")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return { success: false, error: "找不到網站配置" };
  }

  const target = website.is_platform_blog ? "platform" : "wordpress";

  try {
    // 呼叫統一的發布 API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/articles/${article.id}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target,
          website_id: websiteId,
          status,
          syncTargetIds, // 傳入同步目標 ID 列表
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || "發布失敗" };
    }

    const result = await response.json();

    // 使快取失效
    const { data: job } = await supabase
      .from("article_jobs")
      .select("company_id")
      .eq("id", articleJobId)
      .single();
    if (job?.company_id) {
      await invalidateArticleCache(articleJobId, job.company_id);
    }

    revalidatePath("/dashboard/articles/manage");
    return {
      success: true,
      error: null,
      url: result.wordpress_url || result.platform_url,
    };
  } catch (err) {
    console.error("Publish error:", err);
    return { success: false, error: "發布過程發生錯誤" };
  }
}

export async function deleteArticle(articleJobId: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return { success: false, error: "無權限" };
  }

  console.log("[deleteArticle] Deleting article:", {
    articleJobId,
    companyId: membership.company_id,
  });

  const { error, count } = await supabase
    .from("article_jobs")
    .delete({ count: "exact" })
    .eq("id", articleJobId)
    .eq("company_id", membership.company_id);

  console.log("[deleteArticle] Delete result:", { error, count });

  if (error) {
    console.error("[deleteArticle] Failed to delete:", error);
    return { success: false, error: error.message };
  }

  if (count !== null && count === 0) {
    console.warn("[deleteArticle] Article not found or no permission");
    return { success: false, error: "找不到文章或無權刪除" };
  }

  // 使快取失效
  await invalidateArticleCache(articleJobId, membership.company_id);

  revalidatePath("/dashboard/articles/manage");
  return { success: true, error: null };
}

export interface ScheduleResult {
  articleId: string;
  title: string | null;
  scheduledAt: string;
}

export async function scheduleArticlesForPublish(
  articleIds: string[],
  websiteId: string,
  articlesPerDay: number,
  scheduleType?: "daily" | "interval",
  intervalDays?: number,
  syncTargetIds?: string[],
): Promise<{
  success: boolean;
  error?: string;
  scheduledCount?: number;
  scheduledArticles?: ScheduleResult[];
}> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  if (articleIds.length === 0) {
    return { success: false, error: "請選擇要排程的文章" };
  }

  if (!websiteId) {
    return { success: false, error: "請選擇發布網站" };
  }

  if (articlesPerDay < 1 || articlesPerDay > 5) {
    return { success: false, error: "每日發布數量必須在 1-5 之間" };
  }

  const supabase = await createClient();

  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("id, website_name, is_active")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return { success: false, error: "找不到網站配置" };
  }

  if (website.is_active === false) {
    return { success: false, error: "網站已停用" };
  }

  const { data: articles, error: fetchError } = await supabase
    .from("article_jobs")
    .select(
      `
      id,
      status,
      generated_articles (
        id,
        title
      )
    `,
    )
    .in("id", articleIds)
    .in("status", ["completed", "draft", "schedule_failed"]);

  if (fetchError) {
    return { success: false, error: "無法取得文章資料" };
  }

  if (!articles || articles.length === 0) {
    return { success: false, error: "沒有符合條件的文章可排程" };
  }

  // 分離失敗重新排程的文章和一般文章
  const failedArticles = articles.filter((a) => a.status === "schedule_failed");
  const normalArticles = articles.filter((a) => a.status !== "schedule_failed");

  // 查詢該網站已有的最後排程時間，讓新排程接續而非重疊
  const { data: lastScheduled } = await supabase
    .from("article_jobs")
    .select("scheduled_publish_at")
    .eq("website_id", websiteId)
    .eq("status", "scheduled")
    .not("scheduled_publish_at", "is", null)
    .order("scheduled_publish_at", { ascending: false })
    .limit(1)
    .single();

  const lastScheduledDate = lastScheduled?.scheduled_publish_at
    ? new Date(lastScheduled.scheduled_publish_at)
    : null;

  // 只為一般文章計算黃金時段排程
  const scheduleTimes = calculateScheduleTimes(
    normalArticles.length,
    articlesPerDay,
    lastScheduledDate,
    scheduleType,
    intervalDays,
  );

  const scheduledArticles: ScheduleResult[] = [];

  // 處理失敗重新排程的文章：立即發布（+15~30 分鐘）
  for (const article of failedArticles) {
    // 隨機 15~30 分鐘後發布
    const delayMinutes = 15 + Math.floor(Math.random() * 16);
    const immediateSchedule = new Date();
    immediateSchedule.setMinutes(immediateSchedule.getMinutes() + delayMinutes);
    const scheduledAt = immediateSchedule.toISOString();

    const { error: updateError } = await supabase
      .from("article_jobs")
      .update({
        status: "scheduled",
        website_id: websiteId,
        scheduled_publish_at: scheduledAt,
        auto_publish: true,
        // 重新排程時重置重試計數和錯誤訊息
        publish_retry_count: 0,
        last_publish_error: null,
        // 同步目標 ID 列表
        sync_target_ids: syncTargetIds || [],
      })
      .eq("id", article.id);

    if (updateError) {
      console.error(
        `Failed to reschedule failed article ${article.id}:`,
        updateError,
      );
      continue;
    }

    const generatedArticle = article.generated_articles as unknown as {
      id: string;
      title: string;
    } | null;
    const generatedArticleId = generatedArticle?.id;
    const title = generatedArticle?.title || null;

    if (generatedArticleId) {
      await supabase
        .from("generated_articles")
        .update({ website_id: websiteId })
        .eq("id", generatedArticleId);
    }

    scheduledArticles.push({
      articleId: article.id,
      title,
      scheduledAt,
    });
  }

  // 處理一般文章：使用黃金時段排程
  for (let i = 0; i < normalArticles.length; i++) {
    const article = normalArticles[i];
    const scheduledAt = scheduleTimes[i].toISOString();

    const { error: updateError } = await supabase
      .from("article_jobs")
      .update({
        status: "scheduled",
        website_id: websiteId,
        scheduled_publish_at: scheduledAt,
        auto_publish: true,
        // 重新排程時重置重試計數和錯誤訊息
        publish_retry_count: 0,
        last_publish_error: null,
        // 同步目標 ID 列表
        sync_target_ids: syncTargetIds || [],
      })
      .eq("id", article.id);

    if (updateError) {
      console.error(`Failed to schedule article ${article.id}:`, updateError);
      continue;
    }

    // UNIQUE 約束導致 Supabase 返回對象而非陣列，需要先轉為 unknown
    const generatedArticle = article.generated_articles as unknown as {
      id: string;
      title: string;
    } | null;
    const generatedArticleId = generatedArticle?.id;
    const title = generatedArticle?.title || null;

    if (generatedArticleId) {
      // 更新原文的 website_id
      await supabase
        .from("generated_articles")
        .update({ website_id: websiteId })
        .eq("id", generatedArticleId);
    }

    scheduledArticles.push({
      articleId: article.id,
      title,
      scheduledAt,
    });
  }

  // 獲取 companyId 並使快取失效
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (membership?.company_id) {
    await invalidateArticleListCache(membership.company_id);
  }

  revalidatePath("/dashboard/articles/manage");

  return {
    success: true,
    scheduledCount: scheduledArticles.length,
    scheduledArticles,
  };
}

/**
 * 計算批量排程的時間
 *
 * @param articleCount 要排程的文章數量
 * @param articlesPerDay 每日發布篇數（1-5）
 * @param lastScheduledDate 最後一次排程的日期
 * @param scheduleType 排程模式：daily（每日 N 篇）或 interval（每 X 天 1 篇）
 * @param intervalDays 間隔天數（僅在 interval 模式使用）
 * @returns 排程時間陣列
 */
function calculateScheduleTimes(
  articleCount: number,
  articlesPerDay: number,
  lastScheduledDate?: Date | null,
  scheduleType?: "daily" | "interval" | null,
  intervalDays?: number | null,
): Date[] {
  const times: Date[] = [];

  // 使用擴充時段（支援 1-5 篇）
  const slotsUTC = getExtendedSlotsForCount(articlesPerDay);

  const now = new Date();
  let startDate: Date;

  if (lastScheduledDate && lastScheduledDate > now) {
    // 有已有排程：從最後排程的下一天開始
    startDate = new Date(lastScheduledDate);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  } else {
    // 沒有已有排程：從明天開始
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
  }
  startDate.setUTCHours(0, 0, 0, 0);

  // interval 模式：每 X 天發布 1 篇
  if (scheduleType === "interval" && intervalDays && intervalDays > 1) {
    for (let i = 0; i < articleCount; i++) {
      const scheduleTime = new Date(startDate);
      scheduleTime.setUTCDate(scheduleTime.getUTCDate() + i * intervalDays);

      // 使用第一個黃金時段（09:00 台灣時間）
      scheduleTime.setUTCHours(slotsUTC[0]);

      // 加入隨機偏移 (0-15 分鐘)
      const randomOffset = Math.floor(Math.random() * 16);
      scheduleTime.setUTCMinutes(randomOffset);

      times.push(scheduleTime);
    }
    return times;
  }

  // daily 模式：每日發布 N 篇
  for (let i = 0; i < articleCount; i++) {
    const dayIndex = Math.floor(i / articlesPerDay);
    const slotIndex = i % articlesPerDay;

    const scheduleTime = new Date(startDate);
    scheduleTime.setUTCDate(scheduleTime.getUTCDate() + dayIndex);

    // 使用對應的時段
    const slotHourUTC = slotsUTC[slotIndex];
    scheduleTime.setUTCHours(slotHourUTC);

    // 加入隨機偏移 (0-15 分鐘)
    const randomOffset = Math.floor(Math.random() * 16);
    scheduleTime.setUTCMinutes(randomOffset);

    times.push(scheduleTime);
  }

  return times;
}

export async function cancelArticleSchedule(
  articleId: string,
): Promise<{ success: boolean; error?: string; hasWordPressDraft?: boolean }> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  // 獲取 companyId 用於快取失效
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  // 1. 先查詢 article_job 取得關聯的 generated_article 資訊
  const { data: job, error: jobQueryError } = await supabase
    .from("article_jobs")
    .select(
      "id, generated_articles(id, status, wordpress_post_id, wordpress_status)",
    )
    .eq("id", articleId)
    .eq("status", "scheduled")
    .single();

  if (jobQueryError || !job) {
    return { success: false, error: "找不到排程文章或已取消" };
  }

  // 2. 更新 article_jobs 表
  const { error: jobError } = await supabase
    .from("article_jobs")
    .update({
      status: "completed",
      scheduled_publish_at: null,
      auto_publish: false,
    })
    .eq("id", articleId);

  if (jobError) {
    return { success: false, error: "取消排程失敗" };
  }

  // 3. 更新 generated_articles 表（狀態回到待發布、清除排程時間）
  const generatedArticle = job.generated_articles as unknown as {
    id: string;
    status: string;
    wordpress_post_id: number | null;
    wordpress_status: string | null;
  } | null;

  let hasWordPressDraft = false;

  if (generatedArticle?.id) {
    // 檢查是否有 WordPress 草稿
    hasWordPressDraft =
      !!generatedArticle.wordpress_post_id &&
      generatedArticle.wordpress_status === "draft";

    const { error: articleError } = await supabase
      .from("generated_articles")
      .update({
        status: "generated",
        scheduled_publish_at: null,
      })
      .eq("id", generatedArticle.id);

    if (articleError) {
      console.error("更新 generated_articles 失敗:", articleError);
      // 不中斷流程，因為 article_jobs 已更新成功
    }

    // 同時取消該文章所有翻譯版本的排程
    const { error: translationCancelError } = await supabase
      .from("article_translations")
      .update({
        scheduled_publish_at: null,
        auto_publish: false,
        publish_website_id: null,
      })
      .eq("source_article_id", generatedArticle.id)
      .not("scheduled_publish_at", "is", null);

    if (translationCancelError) {
      console.error("取消翻譯排程失敗:", translationCancelError);
      // 不中斷流程
    }
  }

  revalidatePath("/dashboard/articles/manage");

  // 使文章列表快取失效
  if (membership?.company_id) {
    await invalidateArticleListCache(membership.company_id);
  }

  // 如果有 WordPress 草稿，返回提示（草稿仍存在於 WordPress 中）
  return { success: true, hasWordPressDraft };
}

export async function batchDeleteArticles(articleIds: string[]): Promise<{
  success: boolean;
  error?: string;
  deletedCount?: number;
  cancelledCount?: number;
  tokensRefunded?: number;
}> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  if (articleIds.length === 0) {
    return { success: false, error: "請選擇要刪除的文章" };
  }

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) {
    return { success: false, error: "無權限" };
  }

  // 1. 查詢所有任務狀態
  const { data: jobs } = await supabase
    .from("article_jobs")
    .select("id, status")
    .in("id", articleIds)
    .eq("company_id", membership.company_id);

  // 2. 分類：需要先取消的 (pending/processing)
  const needCancelIds = (jobs || [])
    .filter((j) => j.status === "pending" || j.status === "processing")
    .map((j) => j.id);

  // 3. 先取消 pending/processing 狀態的（處理 token 退款）
  let cancelledCount = 0;
  let tokensRefunded = 0;
  if (needCancelIds.length > 0) {
    const cancelResult = await batchCancelArticleGeneration(needCancelIds);
    if (cancelResult.success) {
      cancelledCount = cancelResult.cancelledCount || 0;
      tokensRefunded = cancelResult.totalRefunded || 0;
    }
  }

  console.log("[batchDeleteArticles] Deleting articles:", {
    articleIds,
    companyId: membership.company_id,
    cancelledCount,
    tokensRefunded,
  });

  // 4. 執行刪除
  const { error, count } = await supabase
    .from("article_jobs")
    .delete({ count: "exact" })
    .in("id", articleIds)
    .eq("company_id", membership.company_id);

  console.log("[batchDeleteArticles] Delete result:", { error, count });

  if (error) {
    console.error("[batchDeleteArticles] Failed to delete:", error);
    return { success: false, error: error.message };
  }

  if (count !== null && count === 0) {
    console.warn(
      "[batchDeleteArticles] No articles deleted - possibly wrong company or already deleted",
    );
    return { success: false, error: "找不到文章或無權刪除" };
  }

  // 使快取失效（批量刪除只需失效列表快取）
  await invalidateArticleListCache(membership.company_id);

  revalidatePath("/dashboard/articles/manage");
  return {
    success: true,
    deletedCount: count ?? articleIds.length,
    cancelledCount,
    tokensRefunded,
  };
}

export async function cancelArticleGeneration(articleJobId: string): Promise<{
  success: boolean;
  error?: string;
  tokensDeducted?: number;
  tokensRefunded?: number;
}> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  try {
    const supabase = await createClient();

    // 1. 驗證用戶權限
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return { success: false, error: "無權限" };
    }

    // 2. 查詢任務狀態
    const { data: job, error: jobError } = await supabase
      .from("article_jobs")
      .select("id, status, progress, company_id")
      .eq("id", articleJobId)
      .eq("company_id", membership.company_id)
      .single();

    if (jobError || !job) {
      return { success: false, error: "任務不存在" };
    }

    // 3. 檢查狀態（只能取消 pending 或 processing）
    if (job.status !== "pending" && job.status !== "processing") {
      return { success: false, error: `無法取消 ${job.status} 狀態的任務` };
    }

    // 4. 計算扣款金額（按進度百分比）
    const progress = job.progress || 0;
    const tokensToDeduct =
      job.status === "pending"
        ? 0 // pending 狀態未開始，不扣款
        : Math.ceil((progress / 100) * RESERVED_TOKENS); // processing 狀態按進度扣款
    const tokensToRefund = RESERVED_TOKENS - tokensToDeduct;

    // 5. 更新任務狀態為 cancelled
    const { error: updateError } = await supabase
      .from("article_jobs")
      .update({
        status: "cancelled",
        error_message: `用戶取消生成（進度 ${progress}%，扣除 ${tokensToDeduct} tokens）`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", articleJobId);

    if (updateError) {
      console.error("Error updating job status:", updateError);
      return { success: false, error: "更新狀態失敗" };
    }

    // 6. 處理預扣退還
    const billingService = new TokenBillingService(supabase);

    if (tokensToDeduct > 0) {
      // 有部分使用，需要扣款後釋放剩餘
      await billingService.releaseReservation(articleJobId);

      // 然後扣除實際使用的 tokens
      const { data: subscription } = await supabase
        .from("company_subscriptions")
        .select("monthly_quota_balance, purchased_token_balance")
        .eq("company_id", membership.company_id)
        .single();

      if (subscription) {
        let remainingToDeduct = tokensToDeduct;
        let newPurchased = subscription.purchased_token_balance || 0;
        let newMonthly = subscription.monthly_quota_balance || 0;

        if (newPurchased > 0) {
          const deductFromPurchased = Math.min(remainingToDeduct, newPurchased);
          newPurchased -= deductFromPurchased;
          remainingToDeduct -= deductFromPurchased;
        }

        if (remainingToDeduct > 0) {
          newMonthly = Math.max(0, newMonthly - remainingToDeduct);
        }

        await supabase
          .from("company_subscriptions")
          .update({
            purchased_token_balance: newPurchased,
            monthly_quota_balance: newMonthly,
          })
          .eq("company_id", membership.company_id);
      }
    } else {
      // pending 狀態，全額退還預扣
      await billingService.releaseReservation(articleJobId);
    }

    revalidatePath("/dashboard/articles/manage");
    return {
      success: true,
      tokensDeducted: tokensToDeduct,
      tokensRefunded: tokensToRefund,
    };
  } catch (err) {
    console.error("Cancel generation error:", err);
    return { success: false, error: "取消過程發生錯誤" };
  }
}

export async function batchCancelArticleGeneration(
  articleIds: string[],
): Promise<{
  success: boolean;
  error?: string;
  cancelledCount?: number;
  totalDeducted?: number;
  totalRefunded?: number;
}> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  if (articleIds.length === 0) {
    return { success: false, error: "請選擇要取消的文章" };
  }

  let cancelledCount = 0;
  let totalDeducted = 0;
  let totalRefunded = 0;

  for (const articleId of articleIds) {
    const result = await cancelArticleGeneration(articleId);
    if (result.success) {
      cancelledCount++;
      totalDeducted += result.tokensDeducted || 0;
      totalRefunded += result.tokensRefunded || 0;
    }
  }

  revalidatePath("/dashboard/articles/manage");
  return {
    success: cancelledCount > 0,
    cancelledCount,
    totalDeducted,
    totalRefunded,
  };
}

export async function updateArticleContent(
  articleJobId: string,
  title: string,
  content: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  // 獲取 companyId 用於快取失效
  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const { error } = await supabase
    .from("generated_articles")
    .update({
      title,
      html_content: content,
      updated_at: new Date().toISOString(),
    })
    .eq("article_job_id", articleJobId);

  if (error) {
    console.error("Failed to update article:", error);
    return { success: false, error: error.message };
  }

  // 使快取失效
  await invalidateArticleCache(articleJobId, membership?.company_id);

  revalidatePath("/dashboard/articles/manage");
  return { success: true };
}
