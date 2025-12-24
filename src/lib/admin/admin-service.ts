/**
 * Admin 服務層
 * 處理管理員對訂閱的操作：延長期限、贈送篇數、記錄操作歷史
 */

import { createAdminClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database.types";

type AdminActionLog =
  Database["public"]["Tables"]["admin_action_logs"]["Insert"];

/**
 * 訂閱資訊（含公司資料）
 */
export interface SubscriptionWithCompany {
  id: string;
  company_id: string;
  plan_id: string | null;
  status: string;
  articles_per_month: number;
  subscription_articles_remaining: number;
  purchased_articles_remaining: number;
  current_period_start: string | null;
  current_period_end: string | null;
  billing_cycle: "monthly" | "yearly" | null;
  is_lifetime: boolean;
  created_at: string;
  updated_at: string;
  company: {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    subscription_tier: string | null;
  };
  plan: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

/**
 * 取得所有會員訂閱資訊
 */
export async function getAllSubscriptions(): Promise<
  SubscriptionWithCompany[]
> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("company_subscriptions")
    .select(
      `
      *,
      company:companies!inner(id, name, slug, owner_id, subscription_tier),
      plan:subscription_plans(id, name, slug)
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("取得訂閱列表失敗:", error);
    throw new Error(`取得訂閱列表失敗: ${error.message}`);
  }

  return data as unknown as SubscriptionWithCompany[];
}

/**
 * 延長訂閱期限
 */
export async function extendSubscription(params: {
  companyId: string;
  days: number;
  adminUserId: string;
  adminEmail: string;
  reason?: string;
}): Promise<void> {
  const { companyId, days, adminUserId, adminEmail, reason } = params;
  const supabase = createAdminClient();

  // 取得目前訂閱資訊
  const { data: subscription, error: fetchError } = await supabase
    .from("company_subscriptions")
    .select("*, company:companies(name)")
    .eq("company_id", companyId)
    .single();

  if (fetchError || !subscription) {
    throw new Error(`找不到公司訂閱: ${companyId}`);
  }

  // 計算新的到期日
  const currentEndDate = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date();
  const newEndDate = new Date(currentEndDate);
  newEndDate.setDate(newEndDate.getDate() + days);

  // 更新訂閱
  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update({
      current_period_end: newEndDate.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (updateError) {
    throw new Error(`更新訂閱失敗: ${updateError.message}`);
  }

  // 記錄操作
  await logAdminAction({
    admin_user_id: adminUserId,
    admin_email: adminEmail,
    action_type: "extend_subscription",
    target_type: "subscription",
    target_id: subscription.id,
    target_name: (subscription.company as { name: string })?.name || companyId,
    action_details: {
      previous_end_date: subscription.current_period_end,
      new_end_date: newEndDate.toISOString(),
      days_extended: days,
      reason: reason || null,
    } as unknown as Json,
  });
}

/**
 * 贈送額外篇數
 */
export async function grantArticles(params: {
  companyId: string;
  articles: number;
  adminUserId: string;
  adminEmail: string;
  reason?: string;
}): Promise<void> {
  const { companyId, articles, adminUserId, adminEmail, reason } = params;
  const supabase = createAdminClient();

  // 取得目前訂閱資訊
  const { data: subscription, error: fetchError } = await supabase
    .from("company_subscriptions")
    .select("*, company:companies(name)")
    .eq("company_id", companyId)
    .single();

  if (fetchError || !subscription) {
    throw new Error(`找不到公司訂閱: ${companyId}`);
  }

  const previousRemaining = subscription.purchased_articles_remaining || 0;
  const newRemaining = previousRemaining + articles;

  // 更新加購篇數
  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update({
      purchased_articles_remaining: newRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (updateError) {
    throw new Error(`更新篇數失敗: ${updateError.message}`);
  }

  // 記錄操作
  await logAdminAction({
    admin_user_id: adminUserId,
    admin_email: adminEmail,
    action_type: "grant_articles",
    target_type: "subscription",
    target_id: subscription.id,
    target_name: (subscription.company as { name: string })?.name || companyId,
    action_details: {
      previous_remaining: previousRemaining,
      articles_granted: articles,
      new_remaining: newRemaining,
      reason: reason || null,
    } as unknown as Json,
  });
}

/**
 * 調整訂閱設定（通用方法）
 */
export async function adjustSubscription(params: {
  companyId: string;
  updates: {
    articles_per_month?: number;
    status?: string;
    billing_cycle?: "monthly" | "yearly";
  };
  adminUserId: string;
  adminEmail: string;
  reason?: string;
}): Promise<void> {
  const { companyId, updates, adminUserId, adminEmail, reason } = params;
  const supabase = createAdminClient();

  // 取得目前訂閱資訊
  const { data: subscription, error: fetchError } = await supabase
    .from("company_subscriptions")
    .select("*, company:companies(name)")
    .eq("company_id", companyId)
    .single();

  if (fetchError || !subscription) {
    throw new Error(`找不到公司訂閱: ${companyId}`);
  }

  // 記錄變更前的值
  const previousValues: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    previousValues[key] = subscription[key as keyof typeof subscription];
  }

  // 更新訂閱
  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", companyId);

  if (updateError) {
    throw new Error(`調整訂閱失敗: ${updateError.message}`);
  }

  // 記錄操作
  await logAdminAction({
    admin_user_id: adminUserId,
    admin_email: adminEmail,
    action_type: "adjust_subscription",
    target_type: "subscription",
    target_id: subscription.id,
    target_name: (subscription.company as { name: string })?.name || companyId,
    action_details: {
      previous_values: previousValues,
      new_values: updates,
      reason: reason || null,
    } as unknown as Json,
  });
}

/**
 * 取得操作記錄
 */
export async function getAdminActionLogs(options?: {
  limit?: number;
  offset?: number;
  actionType?: string;
  targetType?: string;
}): Promise<{
  logs: Database["public"]["Tables"]["admin_action_logs"]["Row"][];
  total: number;
}> {
  const { limit = 50, offset = 0, actionType, targetType } = options || {};
  const supabase = createAdminClient();

  let query = supabase
    .from("admin_action_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionType) {
    query = query.eq("action_type", actionType);
  }

  if (targetType) {
    query = query.eq("target_type", targetType);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("取得操作記錄失敗:", error);
    throw new Error(`取得操作記錄失敗: ${error.message}`);
  }

  return {
    logs: data || [],
    total: count || 0,
  };
}

/**
 * 記錄 Admin 操作
 */
async function logAdminAction(log: AdminActionLog): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("admin_action_logs").insert(log);

  if (error) {
    console.error("記錄操作失敗:", error);
    // 不要拋出錯誤，避免影響主要操作
  }
}
