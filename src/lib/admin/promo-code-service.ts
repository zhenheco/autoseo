/**
 * 優惠碼服務層
 * 處理優惠碼的 CRUD、驗證和套用邏輯
 */

import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type PromoCode = Database["public"]["Tables"]["promo_codes"]["Row"];
type PromoCodeInsert = Database["public"]["Tables"]["promo_codes"]["Insert"];
type PromoCodeUpdate = Database["public"]["Tables"]["promo_codes"]["Update"];
type PromoCodeUsage = Database["public"]["Tables"]["promo_code_usages"]["Row"];

/**
 * 驗證結果
 */
export interface PromoCodeValidationResult {
  valid: boolean;
  promoCode?: PromoCode;
  error?: string;
  bonusArticles?: number;
}

/**
 * 取得所有優惠碼（管理員用）
 */
export async function getAllPromoCodes(): Promise<PromoCode[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("取得優惠碼列表失敗:", error);
    throw new Error(`取得優惠碼列表失敗: ${error.message}`);
  }

  return data || [];
}

/**
 * 取得單一優惠碼
 */
export async function getPromoCode(id: string): Promise<PromoCode | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`取得優惠碼失敗: ${error.message}`);
  }

  return data;
}

/**
 * 建立優惠碼
 */
export async function createPromoCode(params: {
  code: string;
  name: string;
  description?: string;
  bonusArticles: number;
  maxUses?: number;
  startsAt?: string;
  expiresAt?: string;
  createdBy: string;
  adminEmail: string;
}): Promise<PromoCode> {
  const {
    code,
    name,
    description,
    bonusArticles,
    maxUses,
    startsAt,
    expiresAt,
    createdBy,
    adminEmail,
  } = params;
  const supabase = createAdminClient();

  // 檢查優惠碼是否已存在
  const { data: existing } = await supabase
    .from("promo_codes")
    .select("id")
    .ilike("code", code)
    .single();

  if (existing) {
    throw new Error(`優惠碼 "${code}" 已存在`);
  }

  const insertData: PromoCodeInsert = {
    code: code.toUpperCase(),
    name,
    description: description || null,
    bonus_articles: bonusArticles,
    max_uses: maxUses || null,
    starts_at: startsAt || new Date().toISOString(),
    expires_at: expiresAt || null,
    is_active: true,
    created_by: createdBy,
  };

  const { data, error } = await supabase
    .from("promo_codes")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`建立優惠碼失敗: ${error.message}`);
  }

  // 記錄操作
  await logAdminAction({
    admin_user_id: createdBy,
    admin_email: adminEmail,
    action_type: "create_promo_code",
    target_type: "promo_code",
    target_id: data.id,
    target_name: code,
    action_details: {
      code,
      name,
      bonus_articles: bonusArticles,
      max_uses: maxUses,
    },
  });

  return data;
}

/**
 * 更新優惠碼
 */
export async function updatePromoCode(params: {
  id: string;
  updates: {
    name?: string;
    description?: string;
    bonusArticles?: number;
    maxUses?: number | null;
    expiresAt?: string | null;
    isActive?: boolean;
  };
  adminUserId: string;
  adminEmail: string;
}): Promise<PromoCode> {
  const { id, updates, adminUserId, adminEmail } = params;
  const supabase = createAdminClient();

  // 取得目前資料
  const { data: current, error: fetchError } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    throw new Error(`找不到優惠碼: ${id}`);
  }

  const updateData: PromoCodeUpdate = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.bonusArticles !== undefined)
    updateData.bonus_articles = updates.bonusArticles;
  if (updates.maxUses !== undefined) updateData.max_uses = updates.maxUses;
  if (updates.expiresAt !== undefined)
    updateData.expires_at = updates.expiresAt;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { data, error } = await supabase
    .from("promo_codes")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(`更新優惠碼失敗: ${error.message}`);
  }

  // 記錄操作
  await logAdminAction({
    admin_user_id: adminUserId,
    admin_email: adminEmail,
    action_type: "update_promo_code",
    target_type: "promo_code",
    target_id: id,
    target_name: current.code,
    action_details: {
      previous_values: current,
      new_values: updates,
    },
  });

  return data;
}

/**
 * 停用優惠碼
 */
export async function deactivatePromoCode(params: {
  id: string;
  adminUserId: string;
  adminEmail: string;
}): Promise<void> {
  const { id, adminUserId, adminEmail } = params;
  const supabase = createAdminClient();

  // 取得目前資料
  const { data: current, error: fetchError } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    throw new Error(`找不到優惠碼: ${id}`);
  }

  const { error } = await supabase
    .from("promo_codes")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(`停用優惠碼失敗: ${error.message}`);
  }

  // 記錄操作
  await logAdminAction({
    admin_user_id: adminUserId,
    admin_email: adminEmail,
    action_type: "deactivate_promo_code",
    target_type: "promo_code",
    target_id: id,
    target_name: current.code,
    action_details: {
      deactivated_at: new Date().toISOString(),
    },
  });
}

/**
 * 驗證優惠碼（公開 API 使用）
 */
export async function validatePromoCode(
  code: string,
  companyId: string,
): Promise<PromoCodeValidationResult> {
  const supabase = await createClient();

  // 查詢優惠碼
  const { data: promoCode, error } = await supabase
    .from("promo_codes")
    .select("*")
    .ilike("code", code)
    .single();

  if (error || !promoCode) {
    return { valid: false, error: "優惠碼不存在" };
  }

  // 檢查是否啟用
  if (!promoCode.is_active) {
    return { valid: false, error: "優惠碼已停用" };
  }

  // 檢查有效期間
  const now = new Date();
  const startsAt = new Date(promoCode.starts_at);
  if (now < startsAt) {
    return { valid: false, error: "優惠碼尚未生效" };
  }

  if (promoCode.expires_at) {
    const expiresAt = new Date(promoCode.expires_at);
    if (now > expiresAt) {
      return { valid: false, error: "優惠碼已過期" };
    }
  }

  // 檢查使用次數
  if (
    promoCode.max_uses !== null &&
    promoCode.current_uses >= promoCode.max_uses
  ) {
    return { valid: false, error: "優惠碼已達使用上限" };
  }

  // 檢查該公司是否已使用過
  const adminClient = createAdminClient();
  const { data: usages } = await adminClient
    .from("promo_code_usages")
    .select("id")
    .eq("promo_code_id", promoCode.id)
    .eq("company_id", companyId);

  if (usages && usages.length > 0) {
    return { valid: false, error: "您已使用過此優惠碼" };
  }

  return {
    valid: true,
    promoCode,
    bonusArticles: promoCode.bonus_articles,
  };
}

/**
 * 套用優惠碼（付款成功後呼叫）
 */
export async function applyPromoCode(params: {
  promoCodeId: string;
  companyId: string;
  paymentOrderId?: string;
}): Promise<void> {
  const { promoCodeId, companyId, paymentOrderId } = params;
  const supabase = createAdminClient();

  // 取得優惠碼
  const { data: promoCode, error: fetchError } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("id", promoCodeId)
    .single();

  if (fetchError || !promoCode) {
    throw new Error(`找不到優惠碼: ${promoCodeId}`);
  }

  // 記錄使用
  const { error: usageError } = await supabase
    .from("promo_code_usages")
    .insert({
      promo_code_id: promoCodeId,
      company_id: companyId,
      payment_order_id: paymentOrderId || null,
      bonus_articles: promoCode.bonus_articles,
    });

  if (usageError) {
    throw new Error(`記錄優惠碼使用失敗: ${usageError.message}`);
  }

  // 增加使用次數
  const { error: incrementError } = await supabase.rpc(
    "increment_promo_code_usage",
    {
      promo_id: promoCodeId,
    },
  );

  if (incrementError) {
    console.error("增加使用次數失敗:", incrementError);
  }

  // 贈送篇數到公司的加購篇數
  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("purchased_articles_remaining")
    .eq("company_id", companyId)
    .single();

  if (subscription) {
    const currentRemaining = subscription.purchased_articles_remaining || 0;
    await supabase
      .from("company_subscriptions")
      .update({
        purchased_articles_remaining:
          currentRemaining + promoCode.bonus_articles,
      })
      .eq("company_id", companyId);
  }
}

/**
 * 透過優惠碼字串套用優惠碼（用於 webhook）
 * 這個函數會先驗證優惠碼，再套用獎勵
 */
export async function applyPromoCodeByCode(
  code: string,
  companyId: string,
  paymentOrderId?: string,
): Promise<{ success: boolean; bonusArticles?: number; error?: string }> {
  const supabase = createAdminClient();

  // 查詢優惠碼
  const { data: promoCode, error: fetchError } = await supabase
    .from("promo_codes")
    .select("*")
    .ilike("code", code)
    .single();

  if (fetchError || !promoCode) {
    return { success: false, error: "優惠碼不存在" };
  }

  // 檢查是否啟用
  if (!promoCode.is_active) {
    return { success: false, error: "優惠碼已停用" };
  }

  // 檢查使用次數限制
  if (promoCode.max_uses && promoCode.current_uses >= promoCode.max_uses) {
    return { success: false, error: "優惠碼使用次數已達上限" };
  }

  try {
    // 記錄使用
    const { error: usageError } = await supabase
      .from("promo_code_usages")
      .insert({
        promo_code_id: promoCode.id,
        company_id: companyId,
        payment_order_id: paymentOrderId || null,
        bonus_articles: promoCode.bonus_articles,
      });

    if (usageError) {
      return {
        success: false,
        error: `記錄優惠碼使用失敗: ${usageError.message}`,
      };
    }

    // 增加使用次數
    await supabase.rpc("increment_promo_code_usage", {
      promo_id: promoCode.id,
    });

    // 贈送篇數到公司的加購篇數
    const { data: subscription } = await supabase
      .from("company_subscriptions")
      .select("purchased_articles_remaining")
      .eq("company_id", companyId)
      .single();

    if (subscription) {
      const currentRemaining = subscription.purchased_articles_remaining || 0;
      await supabase
        .from("company_subscriptions")
        .update({
          purchased_articles_remaining:
            currentRemaining + promoCode.bonus_articles,
        })
        .eq("company_id", companyId);
    }

    return { success: true, bonusArticles: promoCode.bonus_articles };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "套用優惠碼失敗",
    };
  }
}

/**
 * 取得優惠碼使用記錄
 */
export async function getPromoCodeUsages(
  promoCodeId: string,
): Promise<PromoCodeUsage[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("promo_code_usages")
    .select("*")
    .eq("promo_code_id", promoCodeId)
    .order("used_at", { ascending: false });

  if (error) {
    throw new Error(`取得使用記錄失敗: ${error.message}`);
  }

  return data || [];
}

/**
 * 記錄 Admin 操作（內部函數）
 */
async function logAdminAction(log: {
  admin_user_id: string;
  admin_email: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_name: string;
  action_details: Record<string, unknown>;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("admin_action_logs").insert({
    admin_user_id: log.admin_user_id,
    admin_email: log.admin_email,
    action_type: log.action_type as
      | "create_promo_code"
      | "update_promo_code"
      | "deactivate_promo_code",
    target_type: log.target_type as "promo_code",
    target_id: log.target_id,
    target_name: log.target_name,
    action_details: log.action_details,
  });

  if (error) {
    console.error("記錄操作失敗:", error);
  }
}
