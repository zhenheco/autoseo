/**
 * 用戶公司查詢工具
 *
 * 本專案使用 company_members 表管理公司關聯（多對多模式）
 * 此函數提供統一的公司查詢邏輯，確保所有 API 使用一致的資料來源
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * 取得用戶的主要公司 ID
 *
 * 查詢優先順序：
 * 1. company_members 表（主要）- 取得最早建立的 active 成員記錄
 * 2. profiles.company_id（備用）- 相容舊版資料
 *
 * @param supabase - Supabase client 實例
 * @param userId - 用戶 ID
 * @returns 公司 ID 或 null
 */
export async function getUserCompanyId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  // 1. 優先查詢 company_members 表
  const { data: member, error: memberError } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!memberError && member?.company_id) {
    return member.company_id;
  }

  // 2. 備用：查詢 profiles.company_id（相容舊版資料）
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profileError && profile?.company_id) {
    return profile.company_id;
  }

  return null;
}

/**
 * 取得用戶的公司 ID，如果沒有則返回友善的錯誤回應
 *
 * 適用於 API routes 中，自動處理「沒有公司」的情況
 *
 * @param supabase - Supabase client 實例
 * @param userId - 用戶 ID
 * @returns 包含 companyId 或 errorResponse 的結果
 */
export async function getUserCompanyIdOrError(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { companyId: string; errorResponse: null }
  | { companyId: null; errorResponse: NoCompanyErrorResponse }
> {
  const companyId = await getUserCompanyId(supabase, userId);

  if (!companyId) {
    return {
      companyId: null,
      errorResponse: {
        error: "需要設定公司",
        code: "NO_COMPANY",
        message: "請先在「設定」頁面建立或加入公司，才能使用此功能",
        redirectTo: "/dashboard/settings",
      },
    };
  }

  return { companyId, errorResponse: null };
}

/**
 * 沒有公司時的錯誤回應結構
 */
export interface NoCompanyErrorResponse {
  error: string;
  code: "NO_COMPANY";
  message: string;
  redirectTo: string;
}
