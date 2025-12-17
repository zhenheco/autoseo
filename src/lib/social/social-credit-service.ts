/**
 * 社群發文點數服務
 *
 * 處理點數餘額查詢、扣點、FIFO 追蹤等邏輯
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// 型別定義
// ============================================

/** 點數套餐 */
export interface SocialCreditPackage {
  id: string;
  name: string;
  slug: string;
  credits: number;
  price: number;
  description: string | null;
  is_active: boolean;
}

/** 公司點數餘額 */
export interface CompanySocialCredits {
  id: string;
  company_id: string;
  credits_remaining: number;
  credits_used: number;
  created_at: string;
  updated_at: string;
}

/** 購買記錄 */
export interface PurchasedSocialCredit {
  id: string;
  company_id: string;
  package_id: string | null;
  payment_order_id: string | null;
  source_type: "purchase" | "promotion" | "refund_credit" | "manual";
  original_credits: number;
  remaining_credits: number;
  expires_at: string | null;
  created_at: string;
}

/** 點數餘額摘要 */
export interface CreditBalanceSummary {
  /** 總剩餘點數 */
  totalRemaining: number;
  /** 已使用點數 */
  totalUsed: number;
  /** 即將過期的點數（30 天內） */
  expiringCredits: number;
  /** 購買記錄明細 */
  purchaseRecords: PurchasedSocialCredit[];
}

/** 扣點結果 */
export interface DeductCreditsResult {
  success: boolean;
  creditsDeducted: number;
  remainingCredits: number;
  error?: string;
}

// ============================================
// 服務類別
// ============================================

export class SocialCreditService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // ============================================
  // 套餐查詢
  // ============================================

  /**
   * 取得所有可購買的點數套餐
   */
  async getActivePackages(): Promise<SocialCreditPackage[]> {
    const { data, error } = await this.supabase
      .from("social_credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    if (error) {
      throw new Error(`查詢套餐失敗: ${error.message}`);
    }

    return data || [];
  }

  /**
   * 根據 ID 取得套餐
   */
  async getPackageById(packageId: string): Promise<SocialCreditPackage | null> {
    const { data, error } = await this.supabase
      .from("social_credit_packages")
      .select("*")
      .eq("id", packageId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 找不到記錄
      }
      throw new Error(`查詢套餐失敗: ${error.message}`);
    }

    return data;
  }

  // ============================================
  // 餘額查詢
  // ============================================

  /**
   * 取得公司的點數餘額
   */
  async getBalance(companyId: string): Promise<CompanySocialCredits | null> {
    const { data, error } = await this.supabase
      .from("company_social_credits")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // 尚未有記錄
      }
      throw new Error(`查詢餘額失敗: ${error.message}`);
    }

    return data;
  }

  /**
   * 取得點數餘額摘要（包含購買記錄和即將過期的點數）
   */
  async getBalanceSummary(companyId: string): Promise<CreditBalanceSummary> {
    // 取得餘額
    const balance = await this.getBalance(companyId);

    // 取得有剩餘點數的購買記錄
    const { data: records, error } = await this.supabase
      .from("purchased_social_credits")
      .select("*")
      .eq("company_id", companyId)
      .gt("remaining_credits", 0)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`查詢購買記錄失敗: ${error.message}`);
    }

    // 計算 30 天內過期的點數
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);

    const expiringCredits = (records || [])
      .filter((r) => r.expires_at && new Date(r.expires_at) <= thirtyDaysLater)
      .reduce((sum, r) => sum + r.remaining_credits, 0);

    return {
      totalRemaining: balance?.credits_remaining || 0,
      totalUsed: balance?.credits_used || 0,
      expiringCredits,
      purchaseRecords: records || [],
    };
  }

  /**
   * 檢查是否有足夠點數
   */
  async hasEnoughCredits(
    companyId: string,
    requiredCredits: number,
  ): Promise<boolean> {
    const balance = await this.getBalance(companyId);
    return (balance?.credits_remaining || 0) >= requiredCredits;
  }

  // ============================================
  // 點數扣除（FIFO）
  // ============================================

  /**
   * 扣除點數（使用 FIFO 方式）
   *
   * @param companyId 公司 ID
   * @param credits 要扣除的點數
   * @param reason 扣點原因（用於日誌）
   * @returns 扣點結果
   */
  async deductCredits(
    companyId: string,
    credits: number,
    reason?: string,
  ): Promise<DeductCreditsResult> {
    // 1. 檢查餘額是否足夠
    const balance = await this.getBalance(companyId);
    if (!balance || balance.credits_remaining < credits) {
      return {
        success: false,
        creditsDeducted: 0,
        remainingCredits: balance?.credits_remaining || 0,
        error: "點數不足",
      };
    }

    // 2. 取得有剩餘點數的購買記錄（FIFO：按建立時間排序）
    const { data: records, error: recordsError } = await this.supabase
      .from("purchased_social_credits")
      .select("*")
      .eq("company_id", companyId)
      .gt("remaining_credits", 0)
      .order("created_at", { ascending: true });

    if (recordsError) {
      return {
        success: false,
        creditsDeducted: 0,
        remainingCredits: balance.credits_remaining,
        error: `查詢購買記錄失敗: ${recordsError.message}`,
      };
    }

    // 3. FIFO 扣點
    let remainingToDeduct = credits;
    const updates: { id: string; remaining_credits: number }[] = [];

    for (const record of records || []) {
      if (remainingToDeduct <= 0) break;

      // 檢查是否已過期
      if (record.expires_at && new Date(record.expires_at) < new Date()) {
        continue; // 跳過已過期的記錄
      }

      const deductFromThis = Math.min(
        record.remaining_credits,
        remainingToDeduct,
      );
      updates.push({
        id: record.id,
        remaining_credits: record.remaining_credits - deductFromThis,
      });
      remainingToDeduct -= deductFromThis;
    }

    // 4. 如果無法扣完（理論上不應該發生，因為已檢查餘額）
    if (remainingToDeduct > 0) {
      return {
        success: false,
        creditsDeducted: credits - remainingToDeduct,
        remainingCredits: balance.credits_remaining,
        error: "部分點數無法扣除（可能已過期）",
      };
    }

    // 5. 執行更新（使用事務）
    for (const update of updates) {
      const { error: updateError } = await this.supabase
        .from("purchased_social_credits")
        .update({ remaining_credits: update.remaining_credits })
        .eq("id", update.id);

      if (updateError) {
        // 注意：這裡可能需要回滾機制，但 Supabase 不直接支援事務
        // 在生產環境中，建議使用 RPC 函數來處理
        console.error(`更新購買記錄失敗: ${updateError.message}`);
      }
    }

    // 6. 更新餘額表
    const newRemaining = balance.credits_remaining - credits;
    const newUsed = balance.credits_used + credits;

    const { error: balanceError } = await this.supabase
      .from("company_social_credits")
      .update({
        credits_remaining: newRemaining,
        credits_used: newUsed,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId);

    if (balanceError) {
      console.error(`更新餘額失敗: ${balanceError.message}`);
      // 即使餘額更新失敗，FIFO 記錄已更新，返回部分成功
    }

    // 7. 記錄扣點日誌（可選）
    if (reason) {
      console.log(
        `[SocialCreditService] 扣點: companyId=${companyId}, credits=${credits}, reason=${reason}`,
      );
    }

    return {
      success: true,
      creditsDeducted: credits,
      remainingCredits: newRemaining,
    };
  }

  // ============================================
  // 點數增加
  // ============================================

  /**
   * 增加點數（購買或贈送）
   *
   * @param companyId 公司 ID
   * @param credits 要增加的點數
   * @param sourceType 來源類型
   * @param options 其他選項
   */
  async addCredits(
    companyId: string,
    credits: number,
    sourceType: "purchase" | "promotion" | "refund_credit" | "manual",
    options?: {
      packageId?: string;
      paymentOrderId?: string;
      expiresAt?: string;
    },
  ): Promise<void> {
    // 1. 建立購買記錄
    const { error: recordError } = await this.supabase
      .from("purchased_social_credits")
      .insert({
        company_id: companyId,
        package_id: options?.packageId || null,
        payment_order_id: options?.paymentOrderId || null,
        source_type: sourceType,
        original_credits: credits,
        remaining_credits: credits,
        expires_at: options?.expiresAt || null,
      });

    if (recordError) {
      throw new Error(`建立購買記錄失敗: ${recordError.message}`);
    }

    // 2. 更新或建立餘額表
    const balance = await this.getBalance(companyId);

    if (balance) {
      // 更新現有餘額
      const { error: updateError } = await this.supabase
        .from("company_social_credits")
        .update({
          credits_remaining: balance.credits_remaining + credits,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);

      if (updateError) {
        throw new Error(`更新餘額失敗: ${updateError.message}`);
      }
    } else {
      // 建立新餘額記錄
      const { error: insertError } = await this.supabase
        .from("company_social_credits")
        .insert({
          company_id: companyId,
          credits_remaining: credits,
          credits_used: 0,
        });

      if (insertError) {
        throw new Error(`建立餘額記錄失敗: ${insertError.message}`);
      }
    }
  }

  // ============================================
  // 過期點數處理
  // ============================================

  /**
   * 清理過期點數
   * 建議透過 Cron Job 定期執行
   */
  async cleanupExpiredCredits(): Promise<{
    companiesAffected: number;
    creditsExpired: number;
  }> {
    const now = new Date().toISOString();

    // 1. 找出過期但還有剩餘點數的記錄
    const { data: expiredRecords, error: selectError } = await this.supabase
      .from("purchased_social_credits")
      .select("company_id, remaining_credits")
      .lt("expires_at", now)
      .gt("remaining_credits", 0);

    if (selectError) {
      throw new Error(`查詢過期記錄失敗: ${selectError.message}`);
    }

    if (!expiredRecords || expiredRecords.length === 0) {
      return { companiesAffected: 0, creditsExpired: 0 };
    }

    // 2. 計算每個公司過期的點數
    const companyExpiredCredits = new Map<string, number>();
    let totalExpired = 0;

    for (const record of expiredRecords) {
      const current = companyExpiredCredits.get(record.company_id) || 0;
      companyExpiredCredits.set(
        record.company_id,
        current + record.remaining_credits,
      );
      totalExpired += record.remaining_credits;
    }

    // 3. 將過期記錄的 remaining_credits 設為 0
    const { error: updateRecordsError } = await this.supabase
      .from("purchased_social_credits")
      .update({ remaining_credits: 0 })
      .lt("expires_at", now)
      .gt("remaining_credits", 0);

    if (updateRecordsError) {
      throw new Error(`更新過期記錄失敗: ${updateRecordsError.message}`);
    }

    // 4. 更新各公司的餘額
    for (const [companyId, expiredCredits] of companyExpiredCredits) {
      const balance = await this.getBalance(companyId);
      if (balance) {
        await this.supabase
          .from("company_social_credits")
          .update({
            credits_remaining: Math.max(
              0,
              balance.credits_remaining - expiredCredits,
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("company_id", companyId);
      }
    }

    return {
      companiesAffected: companyExpiredCredits.size,
      creditsExpired: totalExpired,
    };
  }
}

// ============================================
// 工廠函數
// ============================================

/**
 * 建立點數服務實例
 */
export function createSocialCreditService(
  supabase: SupabaseClient,
): SocialCreditService {
  return new SocialCreditService(supabase);
}
