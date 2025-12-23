/**
 * 文章額度服務 - 篇數制計費系統
 *
 * 取代原有的 TokenBillingService，簡化計費邏輯：
 * - 1 篇文章 = 1 單位額度
 * - 優先扣訂閱額度，再扣加購額度（FIFO）
 * - 支援 Lazy Reset（讀取餘額時自動檢查重置）
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ===== 類型定義 =====

/** 文章額度餘額 */
export interface ArticleQuotaBalance {
  /** 訂閱方案剩餘篇數（每月重置） */
  subscriptionRemaining: number;
  /** 加購篇數剩餘（永久有效，含年繳贈品） */
  purchasedRemaining: number;
  /** 總可用篇數 */
  totalAvailable: number;
  /** 每月配額上限 */
  monthlyQuota: number;
  /** 當前週期結束時間 */
  periodEnd: string | null;
  /** 計費週期 */
  billingCycle: "monthly" | "yearly" | null;
}

/** 額度檢查結果 */
export interface QuotaCheckResult {
  /** 額度是否足夠 */
  sufficient: boolean;
  /** 當前餘額資訊 */
  balance: ArticleQuotaBalance;
}

/** 扣篇結果 */
export interface DeductArticleResult {
  success: boolean;
  /** 扣款來源 */
  deductedFrom: "subscription" | "purchased";
  /** 使用記錄 ID */
  logId: string | null;
  /** 訂閱額度剩餘 */
  subscriptionRemaining: number;
  /** 加購額度剩餘 */
  purchasedRemaining: number;
  /** 總剩餘 */
  totalRemaining: number;
  /** 錯誤訊息 */
  error?: string;
  message?: string;
}

/** 預扣結果 */
export interface ReservationResult {
  success: boolean;
  reservationId: string | null;
  availableArticles: number;
  totalReserved: number;
  message?: string;
}

/** 訂閱方案 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  articlesPerMonth: number;
  yearlyBonusMonths: number;
  features: Record<string, unknown>;
}

/** 文章加購包 */
export interface ArticlePackage {
  id: string;
  name: string;
  slug: string;
  articles: number;
  price: number;
  description: string | null;
}

/** 使用記錄 */
export interface UsageLog {
  id: string;
  companyId: string;
  articleJobId: string | null;
  deductedFrom: "subscription" | "purchased";
  articleTitle: string | null;
  createdAt: string;
}

// ===== 服務類別 =====

export class ArticleQuotaService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase;
  }

  // ----- 餘額管理 -----

  /**
   * 取得公司當前文章額度
   * 會自動檢查並重置過期的月配額（Lazy Reset）
   */
  async getBalance(companyId: string): Promise<ArticleQuotaBalance> {
    // 先執行 Lazy Reset 檢查
    // 註：migration 執行後需重新生成 database.types.ts
    await (this.supabase.rpc as CallableFunction)(
      "reset_monthly_quota_if_needed",
      {
        p_company_id: companyId,
      },
    );

    // 註：以下欄位在 migration 執行後才會存在於 database.types.ts
    // 暫時使用類型斷言繞過類型檢查
    const { data, error } = await this.supabase
      .from("company_subscriptions")
      .select(
        `
        subscription_articles_remaining,
        purchased_articles_remaining,
        articles_per_month,
        current_period_end,
        billing_cycle
      `,
      )
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      console.error("[ArticleQuotaService] getBalance error:", error);
    }

    if (!data) {
      return {
        subscriptionRemaining: 0,
        purchasedRemaining: 0,
        totalAvailable: 0,
        monthlyQuota: 0,
        periodEnd: null,
        billingCycle: null,
      };
    }

    // 類型斷言：新欄位在 migration 執行後才會被 database.types.ts 識別
    const typedData = data as unknown as {
      subscription_articles_remaining: number | null;
      purchased_articles_remaining: number | null;
      articles_per_month: number | null;
      current_period_end: string | null;
      billing_cycle: string | null;
    };

    const subscriptionRemaining =
      typedData.subscription_articles_remaining || 0;
    const purchasedRemaining = typedData.purchased_articles_remaining || 0;

    return {
      subscriptionRemaining,
      purchasedRemaining,
      totalAvailable: subscriptionRemaining + purchasedRemaining,
      monthlyQuota: typedData.articles_per_month || 0,
      periodEnd: typedData.current_period_end,
      billingCycle: typedData.billing_cycle as "monthly" | "yearly" | null,
    };
  }

  /**
   * 檢查是否有足夠額度生成文章
   */
  async hasEnoughQuota(
    companyId: string,
    articlesCount: number = 1,
  ): Promise<QuotaCheckResult> {
    const balance = await this.getBalance(companyId);
    return {
      sufficient: balance.totalAvailable >= articlesCount,
      balance,
    };
  }

  // ----- 文章扣款 -----

  /**
   * 扣除文章額度（原子操作）
   * 扣款順序：訂閱額度 -> 加購額度（FIFO）
   *
   * 防呆措施：
   * - 檢測 search_path 問題（"does not exist" 錯誤）
   * - 記錄詳細錯誤日誌供診斷
   */
  async deductArticle(
    companyId: string,
    articleJobId: string,
    options?: {
      userId?: string;
      title?: string;
      keywords?: string[];
    },
  ): Promise<DeductArticleResult> {
    // 註：RPC 函數在 migration 執行後才會被 database.types.ts 識別
    const { data, error } = await (this.supabase.rpc as CallableFunction)(
      "deduct_article_quota",
      {
        p_company_id: companyId,
        p_article_job_id: articleJobId,
        p_user_id: options?.userId || null,
        p_article_title: options?.title || null,
        p_keywords: options?.keywords || null,
      },
    );

    if (error) {
      console.error("[ArticleQuotaService] deductArticle error:", error);

      // 防呆：檢測 search_path 問題
      const errorMsg = error.message || "";
      if (errorMsg.includes("does not exist")) {
        console.error(
          "[ArticleQuotaService] ⚠️ 可能的 search_path 問題！請檢查 RPC 函數的 search_path 設定",
        );
        console.error(
          "[ArticleQuotaService] 修復方式：ALTER FUNCTION deduct_article_quota SET search_path = public",
        );
      }

      return {
        success: false,
        deductedFrom: "subscription",
        logId: null,
        subscriptionRemaining: 0,
        purchasedRemaining: 0,
        totalRemaining: 0,
        error: errorMsg,
      };
    }

    const result = data as Record<string, unknown>;

    if (!result.success) {
      return {
        success: false,
        deductedFrom: "subscription",
        logId: null,
        subscriptionRemaining: 0,
        purchasedRemaining: 0,
        totalRemaining: 0,
        error: result.error as string,
        message: result.message as string,
      };
    }

    return {
      success: true,
      deductedFrom: result.deducted_from as "subscription" | "purchased",
      logId: result.log_id as string,
      subscriptionRemaining: result.subscription_remaining as number,
      purchasedRemaining: result.purchased_remaining as number,
      totalRemaining: result.total_remaining as number,
    };
  }

  /**
   * 退還額度（生成失敗時）
   * 根據使用記錄反向操作
   */
  async refundArticle(companyId: string, logId: string): Promise<boolean> {
    // 註：article_usage_logs 在 migration 執行後才會存在
    // 讀取使用記錄
    const { data: log, error: logError } = await (
      this.supabase.from("article_usage_logs" as "companies") as unknown as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (
              column: string,
              value: string,
            ) => {
              single: () => Promise<{
                data: {
                  id: string;
                  deducted_from: "subscription" | "purchased";
                  purchased_credit_id: string | null;
                } | null;
                error: unknown;
              }>;
            };
          };
        };
      }
    )
      .select("*")
      .eq("id", logId)
      .eq("company_id", companyId)
      .single();

    if (logError || !log) {
      console.error("[ArticleQuotaService] refundArticle - log not found");
      return false;
    }

    // 根據扣款來源退還
    if (log.deducted_from === "subscription") {
      // 使用 RPC 函數來增加訂閱額度
      await (this.supabase.rpc as CallableFunction)(
        "refund_subscription_article",
        {
          p_company_id: companyId,
        },
      );
    } else if (log.deducted_from === "purchased" && log.purchased_credit_id) {
      // 使用 RPC 函數來退還加購額度
      await (this.supabase.rpc as CallableFunction)(
        "refund_purchased_article",
        {
          p_credit_id: log.purchased_credit_id,
        },
      );
    }

    // 刪除使用記錄
    await (
      this.supabase.from("article_usage_logs" as "companies") as unknown as {
        delete: () => { eq: (column: string, value: string) => Promise<void> };
      }
    )
      .delete()
      .eq("id", logId);

    return true;
  }

  // ----- 預扣機制（防止並發超額） -----

  /**
   * 預扣文章額度
   * 在文章生成開始前呼叫，防止並發請求超額
   * 複用現有的 token_reservations 表（status: active/released/consumed）
   */
  async reserveArticles(
    companyId: string,
    jobId: string,
    count: number = 1,
  ): Promise<ReservationResult> {
    // 先檢查餘額
    const balance = await this.getBalance(companyId);

    if (balance.totalAvailable < count) {
      return {
        success: false,
        reservationId: null,
        availableArticles: balance.totalAvailable,
        totalReserved: 0,
        message: "額度不足",
      };
    }

    // 建立預扣記錄（複用現有的 token_reservations 表）
    // 註：token_reservations 可能不在 database.types.ts 中，使用類型斷言
    const { data, error } = await (
      this.supabase.from("token_reservations" as "companies") as unknown as {
        insert: (values: {
          company_id: string;
          job_id: string;
          reserved_amount: number;
          status: string;
        }) => {
          select: (columns: string) => {
            single: () => Promise<{
              data: { id: string } | null;
              error: { message: string } | null;
            }>;
          };
        };
      }
    )
      .insert({
        company_id: companyId,
        job_id: jobId,
        reserved_amount: count, // 1 篇 = 1 單位
        status: "active", // token_reservations 使用 active/released/consumed
      })
      .select("id")
      .single();

    if (error) {
      console.error("[ArticleQuotaService] reserveArticles error:", error);
      return {
        success: false,
        reservationId: null,
        availableArticles: balance.totalAvailable,
        totalReserved: 0,
        message: error.message,
      };
    }

    return {
      success: true,
      reservationId: data?.id || null,
      availableArticles: balance.totalAvailable - count,
      totalReserved: count,
    };
  }

  /**
   * 釋放預扣（任務失敗時）
   */
  async releaseReservation(jobId: string): Promise<boolean> {
    const { error } = await (
      this.supabase.from("token_reservations" as "companies") as unknown as {
        update: (values: { status: string; released_at: string }) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      }
    )
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("status", "active");

    return !error;
  }

  /**
   * 消耗預扣（任務完成時，轉為實際扣款）
   */
  async consumeReservation(jobId: string): Promise<boolean> {
    const { error } = await (
      this.supabase.from("token_reservations" as "companies") as unknown as {
        update: (values: { status: string; released_at: string }) => {
          eq: (
            column: string,
            value: string,
          ) => {
            eq: (column: string, value: string) => Promise<{ error: unknown }>;
          };
        };
      }
    )
      .update({ status: "consumed", released_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("status", "active");

    return !error;
  }

  // ----- 方案與加購包查詢 -----

  /** 訂閱方案資料類型（內部用） */
  private planType = {} as {
    id: string;
    name: string;
    slug: string;
    monthly_price: number;
    yearly_price: number | null;
    articles_per_month: number | null;
    yearly_bonus_months: number | null;
    features: unknown;
  };

  /**
   * 取得可用的訂閱方案（排除免費方案）
   */
  async getAvailablePlans(): Promise<SubscriptionPlan[]> {
    // 註：articles_per_month, yearly_bonus_months 在 migration 後才會存在
    const { data } = await this.supabase
      .from("subscription_plans")
      .select("*")
      .neq("slug", "free")
      .order("monthly_price", { ascending: true });

    const plans = (data || []) as unknown as (typeof this.planType)[];

    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      monthlyPrice: plan.monthly_price,
      yearlyPrice: plan.yearly_price,
      articlesPerMonth: plan.articles_per_month || 0,
      yearlyBonusMonths: plan.yearly_bonus_months || 0,
      features: (plan.features as Record<string, unknown>) || {},
    }));
  }

  /**
   * 根據 slug 取得方案
   */
  async getPlanBySlug(slug: string): Promise<SubscriptionPlan | null> {
    const { data } = await this.supabase
      .from("subscription_plans")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!data) return null;

    const plan = data as unknown as typeof this.planType;

    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      monthlyPrice: plan.monthly_price,
      yearlyPrice: plan.yearly_price,
      articlesPerMonth: plan.articles_per_month || 0,
      yearlyBonusMonths: plan.yearly_bonus_months || 0,
      features: (plan.features as Record<string, unknown>) || {},
    };
  }

  /**
   * 取得可用的加購包
   * 註：article_packages 表在 migration 後才會存在
   */
  async getAvailablePackages(): Promise<ArticlePackage[]> {
    // 定義加購包資料類型
    type PackageData = {
      id: string;
      name: string;
      slug: string;
      articles: number;
      price: number;
      description: string | null;
      is_active: boolean;
    };

    const { data } = await (
      this.supabase.from("article_packages" as "companies") as unknown as {
        select: (columns: string) => {
          eq: (
            column: string,
            value: boolean,
          ) => {
            order: (
              column: string,
              options: { ascending: boolean },
            ) => Promise<{ data: PackageData[] | null }>;
          };
        };
      }
    )
      .select("*")
      .eq("is_active", true)
      .order("price", { ascending: true });

    return (data || []).map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      slug: pkg.slug,
      articles: pkg.articles,
      price: pkg.price,
      description: pkg.description,
    }));
  }

  // ----- 使用記錄 -----

  /**
   * 取得使用記錄
   * 註：article_usage_logs 表在 migration 後才會存在
   */
  async getUsageHistory(
    companyId: string,
    options: { limit?: number; offset?: number } = {},
  ): Promise<UsageLog[]> {
    // 定義使用記錄類型
    type UsageLogData = {
      id: string;
      company_id: string;
      article_job_id: string | null;
      deducted_from: "subscription" | "purchased";
      article_title: string | null;
      created_at: string;
    };

    // 使用類型斷言處理新表
    type QueryType = {
      select: (columns: string) => QueryType;
      eq: (column: string, value: string) => QueryType;
      order: (column: string, options: { ascending: boolean }) => QueryType;
      limit: (count: number) => QueryType;
      range: (from: number, to: number) => QueryType;
    } & Promise<{ data: UsageLogData[] | null }>;

    let query = (
      this.supabase.from("article_usage_logs" as "companies") as unknown as {
        select: (columns: string) => QueryType;
      }
    )
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 10) - 1,
      );
    }

    const { data } = await query;

    return (data || []).map((log) => ({
      id: log.id,
      companyId: log.company_id,
      articleJobId: log.article_job_id,
      deductedFrom: log.deducted_from,
      articleTitle: log.article_title,
      createdAt: log.created_at,
    }));
  }

  /**
   * 取得使用統計
   */
  async getUsageStats(
    companyId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalArticles: number;
    fromSubscription: number;
    fromPurchased: number;
  }> {
    type StatsQueryType = {
      select: (columns: string) => StatsQueryType;
      eq: (column: string, value: string) => StatsQueryType;
      gte: (column: string, value: string) => StatsQueryType;
      lte: (column: string, value: string) => StatsQueryType;
    } & Promise<{ data: { deducted_from: string }[] | null }>;

    let query = (
      this.supabase.from("article_usage_logs" as "companies") as unknown as {
        select: (columns: string) => StatsQueryType;
      }
    )
      .select("deducted_from")
      .eq("company_id", companyId);

    if (startDate) {
      query = query.gte("created_at", startDate.toISOString());
    }
    if (endDate) {
      query = query.lte("created_at", endDate.toISOString());
    }

    const { data } = await query;

    const logs = data || [];
    return {
      totalArticles: logs.length,
      fromSubscription: logs.filter((l) => l.deducted_from === "subscription")
        .length,
      fromPurchased: logs.filter((l) => l.deducted_from === "purchased").length,
    };
  }
}

// ===== 輔助函數 =====

/**
 * 建立服務實例
 */
export function createArticleQuotaService(
  supabase: ReturnType<typeof createClient<Database>>,
): ArticleQuotaService {
  return new ArticleQuotaService(supabase);
}
