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

export async function publishArticle(articleJobId: string, websiteId: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  const { data: article, error: fetchError } = await supabase
    .from("generated_articles")
    .select("*")
    .eq("article_job_id", articleJobId)
    .single();

  if (fetchError || !article) {
    return { success: false, error: "找不到文章內容" };
  }

  const { data: website, error: websiteError } = await supabase
    .from("website_configs")
    .select("*")
    .eq("id", websiteId)
    .single();

  if (websiteError || !website) {
    return { success: false, error: "找不到網站配置" };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/wordpress/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId: article.id,
          websiteId: websiteId,
          title: article.title,
          content: article.content,
          metaDescription: article.meta_description,
        }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || "發布失敗" };
    }

    const result = await response.json();

    await supabase
      .from("generated_articles")
      .update({
        status: "published",
        published_to_website_id: websiteId,
        published_url: result.url,
        wp_post_id: result.postId?.toString(),
        published_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    await supabase
      .from("article_jobs")
      .update({
        status: "published",
        website_id: websiteId,
        published_at: new Date().toISOString(),
        wp_post_id: result.postId?.toString(),
      })
      .eq("id", articleJobId);

    // 獲取 companyId 並使快取失效
    const { data: job } = await supabase
      .from("article_jobs")
      .select("company_id")
      .eq("id", articleJobId)
      .single();
    if (job?.company_id) {
      await invalidateArticleCache(articleJobId, job.company_id);
    }

    revalidatePath("/dashboard/articles/manage");
    return { success: true, error: null, url: result.url };
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

  if (articlesPerDay < 1 || articlesPerDay > 10) {
    return { success: false, error: "每日發布數量必須在 1-10 之間" };
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
    .in("status", ["completed", "draft"]);

  if (fetchError) {
    return { success: false, error: "無法取得文章資料" };
  }

  if (!articles || articles.length === 0) {
    return { success: false, error: "沒有符合條件的文章可排程" };
  }

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

  const scheduleTimes = calculateScheduleTimes(
    articles.length,
    articlesPerDay,
    lastScheduledDate,
  );

  const scheduledArticles: ScheduleResult[] = [];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const scheduledAt = scheduleTimes[i].toISOString();

    const { error: updateError } = await supabase
      .from("article_jobs")
      .update({
        status: "scheduled",
        website_id: websiteId,
        scheduled_publish_at: scheduledAt,
        auto_publish: true,
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

function calculateScheduleTimes(
  articleCount: number,
  articlesPerDay: number,
  lastScheduledDate?: Date | null,
): Date[] {
  const times: Date[] = [];

  // 台灣時間 (UTC+8) 的工作時段：09:00-21:00 = UTC 01:00-13:00
  const START_HOUR_UTC = 1; // 台灣 09:00
  const END_HOUR_UTC = 13; // 台灣 21:00
  const WORKING_HOURS = END_HOUR_UTC - START_HOUR_UTC; // 12 小時

  // 計算每篇文章的間隔（分鐘）
  const intervalMinutes = Math.floor((WORKING_HOURS * 60) / articlesPerDay);

  const now = new Date();
  let startDate: Date;

  if (lastScheduledDate && lastScheduledDate > now) {
    // 有已有排程：從最後排程的下一天開始
    startDate = new Date(lastScheduledDate);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    startDate.setUTCHours(START_HOUR_UTC, 0, 0, 0);
  } else {
    // 沒有已有排程：從明天開始
    startDate = new Date(now);
    startDate.setUTCDate(startDate.getUTCDate() + 1);
    startDate.setUTCHours(START_HOUR_UTC, 0, 0, 0);
  }

  for (let i = 0; i < articleCount; i++) {
    const dayIndex = Math.floor(i / articlesPerDay);
    const slotIndex = i % articlesPerDay;

    const scheduleTime = new Date(startDate);
    scheduleTime.setUTCDate(scheduleTime.getUTCDate() + dayIndex);

    // 基準時間 + 時段偏移
    const baseMinutes = slotIndex * intervalMinutes;
    // 加入隨機偏移 (±15 分鐘)，讓時間更自然
    const randomOffset = Math.floor(Math.random() * 31) - 15;
    const totalMinutes = Math.max(0, baseMinutes + randomOffset);

    scheduleTime.setUTCHours(START_HOUR_UTC);
    scheduleTime.setUTCMinutes(totalMinutes);

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
  }

  revalidatePath("/dashboard/articles/manage");

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
