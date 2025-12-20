/**
 * Brevo 同步主邏輯
 * 從資料庫獲取用戶數據並同步到 Brevo
 */

import { createAdminClient } from "@/lib/supabase/server";
import { upsertContact } from "./contacts";
import { isBrevoConfigured } from "./client";
import {
  UserDataForBrevo,
  BrevoContactAttributes,
  SyncResult,
  UserSyncResult,
} from "./types";

/**
 * 從資料庫獲取單一用戶的 Brevo 同步數據
 *
 * 查詢流程：
 * 1. 從 auth.users 獲取用戶基本資料（email, created_at, last_sign_in_at）
 * 2. 從 company_members 找到用戶擁有的公司（role = owner）
 * 3. 從 companies 獲取公司資訊
 * 4. 從 company_subscriptions 獲取訂閱和額度資訊
 * 5. 從 article_jobs 統計生成文章數（status = completed）
 * 6. 從 generated_articles 統計發布文章數（status = published）
 * 7. 從 website_configs 檢查是否連接 WordPress
 */
async function fetchUserDataForBrevo(
  userId: string,
): Promise<UserDataForBrevo | null> {
  const adminClient = createAdminClient();

  // 1. 從 auth.users 獲取用戶基本資料
  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(userId);

  if (userError || !userData?.user) {
    console.error(`[Brevo Sync] 無法獲取用戶資料: ${userId}`, userError);
    return null;
  }

  const user = userData.user;

  // 2. 從 company_members 找到用戶擁有的公司
  const { data: membership, error: membershipError } = await adminClient
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .single();

  if (membershipError || !membership) {
    // 用戶可能還沒有公司，跳過
    console.log(`[Brevo Sync] 用戶沒有公司，跳過: ${userId}`);
    return null;
  }

  const companyId = membership.company_id;

  // 3. 從 companies 獲取公司資訊
  const { data: company, error: companyError } = await adminClient
    .from("companies")
    .select("id, name, subscription_tier")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    console.error(`[Brevo Sync] 無法獲取公司資料: ${companyId}`, companyError);
    return null;
  }

  // 4. 從 company_subscriptions 獲取訂閱和額度資訊
  const { data: subscription } = await adminClient
    .from("company_subscriptions")
    .select(
      "subscription_articles_remaining, purchased_articles_remaining, articles_per_month",
    )
    .eq("company_id", companyId)
    .single();

  // 計算額度
  const subscriptionRemaining =
    subscription?.subscription_articles_remaining ?? 0;
  const purchasedRemaining = subscription?.purchased_articles_remaining ?? 0;
  const quotaRemaining = subscriptionRemaining + purchasedRemaining;

  // 5. 從 article_jobs 統計生成文章數
  const { count: articlesGenerated } = await adminClient
    .from("article_jobs")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "completed");

  // 6. 從 generated_articles 統計發布文章數
  const { count: articlesPublished } = await adminClient
    .from("generated_articles")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "published");

  // 7. 從 website_configs 檢查是否連接 WordPress
  const { count: wpCount } = await adminClient
    .from("website_configs")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("wp_enabled", true);

  // 8. 獲取最後生成文章時間
  const { data: lastArticle } = await adminClient
    .from("article_jobs")
    .select("completed_at")
    .eq("company_id", companyId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  // 計算額度使用百分比
  const totalGenerated = articlesGenerated ?? 0;
  const quotaTotal = totalGenerated + quotaRemaining;
  const quotaUsedPercent =
    quotaTotal > 0 ? Math.round((totalGenerated / quotaTotal) * 100) : 0;

  // 構建 Brevo 屬性
  const attributes: Omit<BrevoContactAttributes, "SEGMENT"> = {
    USER_ID: user.id,
    FIRSTNAME: user.email?.split("@")[0] || "User",
    COMPANY_ID: company.id,
    COMPANY_NAME: company.name,
    REGISTERED_AT: user.created_at || new Date().toISOString(),
    PLAN:
      (company.subscription_tier as BrevoContactAttributes["PLAN"]) || "free",
    ARTICLES_GENERATED: articlesGenerated ?? 0,
    ARTICLES_PUBLISHED: articlesPublished ?? 0,
    WP_CONNECTED: (wpCount ?? 0) > 0,
    QUOTA_REMAINING: quotaRemaining,
    QUOTA_USED_PERCENT: quotaUsedPercent,
    LAST_LOGIN_AT:
      user.last_sign_in_at || user.created_at || new Date().toISOString(),
    LAST_ARTICLE_AT: lastArticle?.completed_at || null,
  };

  return {
    email: user.email || "",
    attributes: attributes as BrevoContactAttributes,
  };
}

/**
 * 同步單一用戶到 Brevo
 *
 * @param userId - Supabase auth.users ID
 * @returns 同步結果
 */
export async function syncUserToBrevo(userId: string): Promise<UserSyncResult> {
  // 檢查 Brevo 是否已設定
  if (!isBrevoConfigured()) {
    console.log("[Brevo Sync] BREVO_API_KEY 未設定，跳過同步");
    return {
      success: false,
      userId,
      error: "BREVO_API_KEY 未設定",
    };
  }

  try {
    const userData = await fetchUserDataForBrevo(userId);

    if (!userData || !userData.email) {
      return {
        success: false,
        userId,
        error: "無法獲取用戶資料或用戶沒有 email",
      };
    }

    await upsertContact(userData);

    return {
      success: true,
      userId,
      email: userData.email,
      segment: userData.attributes.SEGMENT,
    };
  } catch (error) {
    console.error(`[Brevo Sync] 同步用戶失敗: ${userId}`, error);
    return {
      success: false,
      userId,
      error: error instanceof Error ? error.message : "未知錯誤",
    };
  }
}

/**
 * 同步所有用戶到 Brevo（用於 Cron Job）
 *
 * 遍歷所有 company_members 中 role = owner 的用戶進行同步
 */
export async function syncAllUsersToBrevo(): Promise<SyncResult> {
  // 檢查 Brevo 是否已設定
  if (!isBrevoConfigured()) {
    console.log("[Brevo Sync] BREVO_API_KEY 未設定，跳過同步");
    return { synced: 0, errors: 0, skipped: 0 };
  }

  const adminClient = createAdminClient();

  // 獲取所有 company owner 的 user_id
  const { data: owners, error } = await adminClient
    .from("company_members")
    .select("user_id")
    .eq("role", "owner");

  if (error || !owners) {
    console.error("[Brevo Sync] 無法獲取用戶列表", error);
    return { synced: 0, errors: 1, skipped: 0 };
  }

  let synced = 0;
  let errors = 0;
  let skipped = 0;

  for (const owner of owners) {
    try {
      const result = await syncUserToBrevo(owner.user_id);

      if (result.success) {
        synced++;
      } else if (result.error?.includes("無法獲取")) {
        skipped++;
      } else {
        errors++;
      }

      // Rate limiting: Brevo API 限制 100 req/s，加 50ms 延遲
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`[Brevo Sync] 同步用戶失敗: ${owner.user_id}`, error);
      errors++;
    }
  }

  console.log(
    `[Brevo Sync] 完成同步: ${synced} 成功, ${errors} 失敗, ${skipped} 跳過`,
  );
  return { synced, errors, skipped };
}

/**
 * 根據公司 ID 同步用戶到 Brevo
 * 用於訂閱變更後的即時同步
 */
export async function syncCompanyOwnerToBrevo(
  companyId: string,
): Promise<UserSyncResult> {
  const adminClient = createAdminClient();

  // 找到公司 owner 的 user_id
  const { data: owner, error } = await adminClient
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("role", "owner")
    .single();

  if (error || !owner) {
    console.error(`[Brevo Sync] 無法找到公司 owner: ${companyId}`, error);
    return {
      success: false,
      userId: "",
      error: "無法找到公司 owner",
    };
  }

  return syncUserToBrevo(owner.user_id);
}
