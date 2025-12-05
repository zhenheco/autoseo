"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { TokenBillingService } from "@/lib/billing/token-billing-service";

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
  generated_articles:
    | {
        id: string;
        title: string;
        html_content: string;
        content_json: Record<string, unknown> | null;
      }[]
    | null;
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
) {
  const user = await getUser();
  if (!user) return { articles: [], error: "未登入" };

  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const companyId = membership?.company_id || user.id;

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
        html_content,
        content_json
      )
    `,
    )
    .eq("company_id", companyId)
    .order("scheduled_publish_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

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
    return { articles: [], error: error.message };
  }

  return { articles: data as ArticleWithWebsite[], error: null };
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

  const scheduleTimes = calculateScheduleTimes(articles.length, articlesPerDay);

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

    const generatedArticle = article.generated_articles as
      | { id: string; title: string }[]
      | null;
    const generatedArticleId = generatedArticle?.[0]?.id;
    const title = generatedArticle?.[0]?.title || null;

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
): Date[] {
  const times: Date[] = [];
  const hoursInterval = Math.floor(12 / articlesPerDay);

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() + 1);
  startDate.setHours(9, 0, 0, 0);

  for (let i = 0; i < articleCount; i++) {
    const dayIndex = Math.floor(i / articlesPerDay);
    const slotIndex = i % articlesPerDay;

    const scheduleTime = new Date(startDate);
    scheduleTime.setDate(scheduleTime.getDate() + dayIndex);
    scheduleTime.setHours(9 + slotIndex * hoursInterval);

    times.push(scheduleTime);
  }

  return times;
}

export async function cancelArticleSchedule(
  articleId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  if (!user) return { success: false, error: "未登入" };

  const supabase = await createClient();

  const { error } = await supabase
    .from("article_jobs")
    .update({
      status: "completed",
      scheduled_publish_at: null,
      auto_publish: false,
    })
    .eq("id", articleId)
    .eq("status", "scheduled");

  if (error) {
    return { success: false, error: "取消排程失敗" };
  }

  revalidatePath("/dashboard/articles/manage");
  return { success: true };
}

export async function batchDeleteArticles(
  articleIds: string[],
): Promise<{ success: boolean; error?: string; deletedCount?: number }> {
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

  console.log("[batchDeleteArticles] Deleting articles:", {
    articleIds,
    companyId: membership.company_id,
  });

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

  revalidatePath("/dashboard/articles/manage");
  return { success: true, deletedCount: count ?? articleIds.length };
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

  revalidatePath("/dashboard/articles/manage");
  return { success: true };
}
