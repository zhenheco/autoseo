import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createCommission } from "@/lib/affiliate-client";
import { TIER_HIERARCHY } from "@/lib/subscription/upgrade-rules";
import { syncCompanyOwnerToBrevo } from "@/lib/brevo";

/**
 * PAYUNi API 回應格式
 */
interface PayUniAPIResponse {
  success: boolean;
  paymentId?: string;
  payuniForm?: {
    action: string;
    method: string;
    fields: Record<string, string>;
  };
  error?: string;
  message?: string;
}

/**
 * 調用 PAYUNi 金流微服務 API
 *
 * 使用正確的 PAYUNi 端點：
 * - 單次付款：/api/payment/create
 * - 定期定額：/api/payment/period
 */
async function callPayUniAPI(
  endpoint: string,
  params: object,
): Promise<PayUniAPIResponse> {
  const baseUrl =
    process.env.PAYMENT_GATEWAY_ENV === "production"
      ? "https://affiliate.1wayseo.com"
      : "https://sandbox.affiliate.1wayseo.com";

  console.log("[PaymentService] 調用 PAYUNi API:", {
    url: `${baseUrl}${endpoint}`,
    hasApiKey: !!process.env.PAYMENT_GATEWAY_API_KEY,
    hasSiteCode: !!process.env.PAYMENT_GATEWAY_SITE_CODE,
  });

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.PAYMENT_GATEWAY_API_KEY || "",
        "X-Site-Code": process.env.PAYMENT_GATEWAY_SITE_CODE || "",
      },
      body: JSON.stringify(params),
    });

    const data = (await response.json()) as PayUniAPIResponse;

    console.log("[PaymentService] PAYUNi API 回應:", {
      status: response.status,
      success: data.success,
      hasPayuniForm: !!data.payuniForm,
      paymentId: data.paymentId,
    });

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.error || data.message || "API 呼叫失敗",
      };
    }

    return data;
  } catch (error) {
    console.error("[PaymentService] PAYUNi API 呼叫失敗:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "網路錯誤",
    };
  }
}

/**
 * PAYUNi Webhook 事件資料結構
 */
interface PayUniWebhookData {
  paymentId: string;
  orderId: string;
  amount: number;
  status: "SUCCESS" | "FAILED" | "PENDING";
  tradeNo?: string;
  paidAt?: string;
  errorMessage?: string;
  periodTradeNo?: string;
  currentPeriod?: number;
}

export interface CreateOnetimeOrderParams {
  companyId: string;
  paymentType:
    | "subscription"
    | "token_package"
    | "lifetime"
    | "article_package";
  relatedId: string;
  amount: number;
  description: string;
  email: string;
}

export interface CreateRecurringOrderParams {
  companyId: string;
  planId: string;
  amount: number;
  description: string;
  email: string;
  periodType: "M";
  periodPoint?: string;
  periodStartType: 2;
  periodTimes: 12;
}

export class PaymentService {
  private supabase: ReturnType<typeof createClient<Database>>;

  constructor(supabase: ReturnType<typeof createClient<Database>>) {
    this.supabase = supabase;
  }

  /**
   * 產生訂單編號
   * 格式：{站點代碼前3字}O{時間戳base36}{隨機3碼}
   * 範例：1WAOmji21wrnabc（15字元，PAYUNi 限制 20 字元）
   */
  private generateOrderNo(): string {
    const sitePrefix = (process.env.PAYMENT_GATEWAY_SITE_CODE || "1WS")
      .slice(0, 3)
      .toUpperCase();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 5);
    return `${sitePrefix}O${timestamp}${random}`;
  }

  /**
   * 產生委託編號
   * 格式：{站點代碼前3字}M{時間戳base36}{隨機3碼}
   * 範例：1WAMmji21wrnabc（15字元，PAYUNi 限制 20 字元）
   */
  private generateMandateNo(): string {
    const sitePrefix = (process.env.PAYMENT_GATEWAY_SITE_CODE || "1WS")
      .slice(0, 3)
      .toUpperCase();
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 5);
    return `${sitePrefix}M${timestamp}${random}`;
  }

  private mapPlanSlugToTier(
    slug: string,
  ): "free" | "starter" | "pro" | "business" | "agency" {
    const validTiers: Array<
      "free" | "starter" | "pro" | "business" | "agency"
    > = ["free", "starter", "pro", "business", "agency"];
    return validTiers.includes(slug as (typeof validTiers)[number])
      ? (slug as (typeof validTiers)[number])
      : "free";
  }

  /**
   * 建立一次性付款
   *
   * 透過金流微服務 API 建立付款（PAYUNi）
   */
  async createOnetimePayment(params: CreateOnetimeOrderParams): Promise<{
    success: boolean;
    orderId?: string;
    orderNo?: string;
    paymentId?: string;
    paymentForm?: {
      action: string;
      method: string;
      fields: Record<string, string>;
    };
    error?: string;
  }> {
    const orderNo = this.generateOrderNo();

    console.log("[PaymentService] 使用 SDK 建立單次付款訂單:", {
      orderNo,
      companyId: params.companyId,
      amount: params.amount,
      paymentType: params.paymentType,
    });

    // 1. 先建立訂單記錄
    const { data: orderData, error: orderError } = await this.supabase
      .from("payment_orders")
      .insert({
        company_id: params.companyId,
        order_no: orderNo,
        order_type: "onetime",
        payment_type: params.paymentType as
          | "subscription"
          | "token_package"
          | "lifetime",
        amount: params.amount,
        item_description: params.description,
        related_id: params.relatedId,
        status: "pending",
      })
      .select<"*", Database["public"]["Tables"]["payment_orders"]["Row"]>()
      .single();

    if (orderError || !orderData) {
      console.error("[PaymentService] 建立訂單失敗:", {
        orderNo,
        error: orderError,
      });
      return { success: false, error: "建立訂單失敗" };
    }

    console.log("[PaymentService] 訂單建立成功:", {
      orderId: orderData.id,
      orderNo: orderData.order_no,
    });

    // 2. 透過 PAYUNi 金流微服務建立付款
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const payuniResult = await callPayUniAPI("/api/payment/create", {
      orderId: orderNo,
      amount: params.amount,
      description: params.description,
      email: params.email,
      callbackUrl: `${baseUrl}/api/payment/result-redirect`,
      metadata: {
        companyId: params.companyId,
        paymentType: params.paymentType,
        relatedId: params.relatedId,
      },
    });

    if (!payuniResult.success || !payuniResult.payuniForm) {
      console.error(
        "[PaymentService] PAYUNi 金流微服務建立付款失敗:",
        payuniResult,
      );
      return { success: false, error: payuniResult.error || "建立付款失敗" };
    }

    console.log("[PaymentService] PAYUNi 金流微服務付款建立成功:", {
      paymentId: payuniResult.paymentId,
      orderId: orderData.id,
    });

    return {
      success: true,
      orderId: orderData.id,
      orderNo: orderData.order_no,
      paymentId: payuniResult.paymentId,
      paymentForm: payuniResult.payuniForm,
    };
  }

  /**
   * 建立定期定額付款
   *
   * 透過金流微服務 API 建立付款（PAYUNi）
   */
  async createRecurringPayment(params: CreateRecurringOrderParams): Promise<{
    success: boolean;
    mandateId?: string;
    mandateNo?: string;
    paymentId?: string;
    paymentForm?: {
      action: string;
      method: string;
      fields: Record<string, string>;
    };
    error?: string;
  }> {
    if (params.periodType !== "M") {
      return { success: false, error: "只支援月繳訂閱" };
    }

    if (params.periodTimes !== 12) {
      return { success: false, error: "月繳訂閱必須為 12 期" };
    }

    if (params.periodStartType !== 2) {
      return { success: false, error: "月繳訂閱必須使用授權完成後開始扣款" };
    }

    const periodPoint =
      params.periodPoint || String(new Date().getDate()).padStart(2, "0");

    console.log("[PaymentService] 使用 SDK 建立月繳 12 期委託:", {
      companyId: params.companyId,
      planId: params.planId,
      amount: params.amount,
      periodPoint,
    });

    const mandateNo = this.generateMandateNo();

    // 1. 建立委託記錄
    const { data: mandateData, error: mandateError } = await this.supabase
      .from("recurring_mandates")
      .insert({
        company_id: params.companyId,
        plan_id: params.planId,
        mandate_no: mandateNo,
        period_type: "M",
        period_point: periodPoint,
        period_times: 12,
        period_amount: params.amount,
        total_amount: params.amount * 12,
        status: "pending",
      })
      .select<"*", Database["public"]["Tables"]["recurring_mandates"]["Row"]>()
      .single();

    if (mandateError || !mandateData) {
      console.error("[PaymentService] 建立委託失敗:", mandateError);
      return { success: false, error: "建立定期定額委託失敗" };
    }

    const orderNo = this.generateOrderNo();

    // 2. 建立首期訂單記錄
    const { data: orderData, error: orderError } = await this.supabase
      .from("payment_orders")
      .insert({
        company_id: params.companyId,
        order_no: orderNo,
        order_type: "recurring_first",
        payment_type: "subscription",
        amount: params.amount,
        item_description: params.description,
        related_id: params.planId,
        status: "pending",
      })
      .select<"*", Database["public"]["Tables"]["payment_orders"]["Row"]>()
      .single();

    if (orderError || !orderData) {
      console.error("[PaymentService] 建立訂單失敗:", orderError);
      return { success: false, error: "建立訂單失敗" };
    }

    await this.supabase
      .from("recurring_mandates")
      .update({ first_payment_order_id: orderData.id })
      .eq("id", mandateData.id);

    // 3. 透過 PAYUNi 金流微服務建立定期定額付款
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const payuniResult = await callPayUniAPI("/api/payment/create", {
      orderId: mandateNo,
      amount: params.amount,
      description: params.description,
      email: params.email,
      callbackUrl: `${baseUrl}/api/payment/result-redirect`,
      metadata: {
        companyId: params.companyId,
        planId: params.planId,
        mandateId: mandateData.id,
      },
      periodParams: {
        periodType: "M",
        periodPoint,
        periodTimes: 12,
        periodStartType: 2,
      },
    });

    if (!payuniResult.success || !payuniResult.payuniForm) {
      console.error(
        "[PaymentService] PAYUNi 金流微服務建立定期定額失敗:",
        payuniResult,
      );
      return {
        success: false,
        error: payuniResult.error || "建立定期定額付款失敗",
      };
    }

    console.log("[PaymentService] PAYUNi 金流微服務定期定額建立成功:", {
      paymentId: payuniResult.paymentId,
      mandateId: mandateData.id,
    });

    return {
      success: true,
      mandateId: mandateData.id,
      mandateNo: mandateData.mandate_no,
      paymentId: payuniResult.paymentId,
      paymentForm: payuniResult.payuniForm,
    };
  }

  /**
   * 處理單次付款回調
   *
   * 接收來自 PAYUNi webhook 的已解密資料
   */
  async handleOnetimeCallback(webhookData: PayUniWebhookData): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const {
        orderId: orderNo,
        status,
        tradeNo,
        amount,
        errorMessage,
      } = webhookData;

      console.log("[PaymentService] 處理 PAYUNi 付款通知:", {
        orderNo,
        status,
        tradeNo,
        amount,
      });

      // 加入重試機制，應對 Supabase 多區域複製延遲
      // 重試策略：最多重試 20 次，總等待時間約 20-25 秒
      // 重試間隔: 500ms, 1000ms, 1500ms, 2000ms, 然後固定 2000ms
      let orderData:
        | Database["public"]["Tables"]["payment_orders"]["Row"]
        | null = null;
      let findError: unknown = null;

      for (let attempt = 1; attempt <= 20; attempt++) {
        const { data, error } = await this.supabase
          .from("payment_orders")
          .select<
            "*",
            Database["public"]["Tables"]["payment_orders"]["Row"]
          >("*")
          .eq("order_no", orderNo)
          .maybeSingle(); // 使用 maybeSingle() 避免 PGRST116 錯誤

        if (data && !error) {
          orderData = data;
          findError = null;
          console.log(`[PaymentService] 成功找到訂單 (第 ${attempt} 次嘗試)`);
          break;
        }

        findError = error;
        console.log(`[PaymentService] 查詢訂單失敗 (嘗試 ${attempt}/20):`, {
          orderNo,
          error,
        });

        if (attempt < 20) {
          // 更長的重試間隔，應對 Supabase 複製延遲
          // 500ms, 1000ms, 1500ms, 2000ms, 2000ms...
          const delay = Math.min(500 * attempt, 2000);
          console.log(
            `[PaymentService] 等待 ${delay}ms 後重試 (應對資料庫複製延遲)`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (findError || !orderData) {
        console.error(
          "[PaymentService] 找不到訂單（已重試20次，總計約20-25秒）:",
          {
            orderNo,
            tradeNo,
            error: findError,
            hint: "可能是 Supabase 多區域複製延遲超過預期",
          },
        );
        return { success: false, error: "找不到訂單" };
      }

      console.log("[PaymentService] 找到訂單:", {
        id: orderData.id,
        status: orderData.status,
      });

      // PAYUNi status: "SUCCESS" | "FAILED" | "PENDING"
      if (status === "SUCCESS") {
        if (orderData.status === "success") {
          console.log("[PaymentService] 訂單已處理過，跳過重複處理:", {
            orderId: orderData.id,
            orderNo,
          });
          return { success: true };
        }

        // 追蹤佣金類型（用於區分首次訂閱、升級、加購等）
        let commissionOrderType:
          | "subscription"
          | "upgrade"
          | "addon"
          | "renewal"
          | "one_time" = "one_time";

        // 更新訂單狀態（使用現有 newebpay_* 欄位，相容舊資料）
        const { error: updateError } = await this.supabase
          .from("payment_orders")
          .update({
            status: "success",
            newebpay_status: status,
            newebpay_message: "付款成功",
            newebpay_trade_no: tradeNo || "",
            newebpay_response:
              webhookData as unknown as Database["public"]["Tables"]["payment_orders"]["Update"]["newebpay_response"],
            paid_at: new Date().toISOString(),
          })
          .eq("id", orderData.id);

        if (updateError) {
          console.error("[PaymentService] 更新訂單狀態失敗:", updateError);
          return { success: false, error: "更新訂單狀態失敗" };
        }

        if (
          orderData.payment_type === "token_package" &&
          orderData.related_id
        ) {
          // Token 包加購
          commissionOrderType = "addon";

          const { data: packageData, error: packageError } = await this.supabase
            .from("token_packages")
            .select<
              "*",
              Database["public"]["Tables"]["token_packages"]["Row"]
            >("*")
            .eq("id", orderData.related_id)
            .single();

          if (packageError || !packageData) {
            console.error("[PaymentService] Credit 包不存在:", packageError);
            return { success: false, error: "Credit 包不存在" };
          }

          console.log("[PaymentService] Credit 包資料:", {
            packageId: packageData.id,
            packageName: packageData.name,
            tokens: packageData.tokens,
          });

          console.log(
            "[PaymentService] 準備查詢公司, company_id:",
            orderData.company_id,
          );

          // 加入重試機制查詢公司
          let company: { seo_token_balance: number } | null = null;
          let companyError: unknown = null;

          for (let attempt = 1; attempt <= 10; attempt++) {
            console.log(
              `[PaymentService] 查詢公司嘗試 ${attempt}/10, company_id: ${orderData.company_id}`,
            );

            const { data, error } = await this.supabase
              .from("companies")
              .select<
                "seo_token_balance",
                { seo_token_balance: number }
              >("seo_token_balance")
              .eq("id", orderData.company_id)
              .maybeSingle();

            console.log(`[PaymentService] 查詢結果 (嘗試 ${attempt}/10):`, {
              hasData: !!data,
              error: error?.message || null,
              errorCode: error?.code || null,
            });

            if (data && !error) {
              company = data;
              companyError = null;
              console.log(
                `[PaymentService] 找到公司 (嘗試 ${attempt}/10), seo_token_balance:`,
                data.seo_token_balance,
              );
              break;
            }

            companyError = error;
            console.log(`[PaymentService] 查詢公司失敗 (嘗試 ${attempt}/10):`, {
              company_id: orderData.company_id,
              error,
            });

            if (attempt < 10) {
              const delay = Math.min(1000 * attempt, 3000);
              console.log(`[PaymentService] 等待 ${delay}ms 後重試`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }

          if (companyError || !company) {
            console.error("[PaymentService] 重試 10 次後仍查詢公司失敗:", {
              company_id: orderData.company_id,
              error: companyError,
            });

            // 列出最近的公司記錄以供診斷
            const { data: recentCompanies } = await this.supabase
              .from("companies")
              .select("id, name, created_at")
              .order("created_at", { ascending: false })
              .limit(5);

            console.error(
              "[PaymentService] 最近 5 筆公司記錄:",
              recentCompanies,
            );

            return { success: false, error: "查詢公司失敗" };
          }

          const newBalance = company.seo_token_balance + packageData.tokens;

          const { error: updateError } = await this.supabase
            .from("companies")
            .update({ seo_token_balance: newBalance })
            .eq("id", orderData.company_id);

          if (updateError) {
            console.error("[PaymentService] 更新 Token 餘額失敗:", updateError);
            return { success: false, error: "更新 Token 餘額失敗" };
          }

          // 同時更新 company_subscriptions 的 purchased_token_balance
          const { data: subscription } = await this.supabase
            .from("company_subscriptions")
            .select("purchased_token_balance")
            .eq("company_id", orderData.company_id)
            .eq("status", "active")
            .maybeSingle();

          if (subscription) {
            const newPurchasedBalance =
              (subscription.purchased_token_balance || 0) + packageData.tokens;
            const { error: subscriptionUpdateError } = await this.supabase
              .from("company_subscriptions")
              .update({ purchased_token_balance: newPurchasedBalance })
              .eq("company_id", orderData.company_id)
              .eq("status", "active");

            if (subscriptionUpdateError) {
              console.error(
                "[PaymentService] 更新訂閱購買餘額失敗:",
                subscriptionUpdateError,
              );
            } else {
              console.log("[PaymentService] 訂閱購買餘額已更新:", {
                balanceBefore: subscription.purchased_token_balance || 0,
                balanceAfter: newPurchasedBalance,
              });
            }
          }

          console.log("[PaymentService] Credit 包處理成功:", {
            packageName: packageData.name,
            tokens: packageData.tokens,
            balanceBefore: company.seo_token_balance,
            balanceAfter: newBalance,
          });
        } else if (
          (orderData.payment_type as string) === "article_package" &&
          orderData.related_id
        ) {
          // 篇數制加購包
          commissionOrderType = "addon";
          // 類型定義（article_packages 表尚未在 database.types.ts 中）
          interface ArticlePackageRow {
            id: string;
            slug: string;
            name: string;
            price: number;
            articles: number;
          }

          const { data: rawPackageData, error: packageError } =
            await this.supabase
              .from("article_packages" as "token_packages") // 暫時類型斷言
              .select("*")
              .eq("id", orderData.related_id)
              .single();

          const packageData =
            rawPackageData as unknown as ArticlePackageRow | null;

          if (packageError || !packageData) {
            console.error("[PaymentService] 加購包不存在:", packageError);
            return { success: false, error: "加購包不存在" };
          }

          console.log("[PaymentService] 加購包資料:", {
            packageId: packageData.id,
            packageSlug: packageData.slug,
            articles: packageData.articles,
          });

          // 查詢公司訂閱
          const { data: rawSubscription, error: subError } = await this.supabase
            .from("company_subscriptions")
            .select("id, purchased_articles_remaining")
            .eq("company_id", orderData.company_id)
            .eq("status", "active")
            .maybeSingle();

          // 類型斷言（purchased_articles_remaining 欄位尚未在 database.types.ts 中）
          const subscription = rawSubscription as unknown as {
            id: string;
            purchased_articles_remaining: number | null;
          } | null;

          if (subError) {
            console.error("[PaymentService] 查詢訂閱失敗:", subError);
            return { success: false, error: "查詢訂閱失敗" };
          }

          if (subscription) {
            // 更新現有訂閱的加購篇數
            const currentPurchased =
              subscription.purchased_articles_remaining || 0;
            const newPurchased = currentPurchased + packageData.articles;

            const { error: updateSubError } = await this.supabase
              .from("company_subscriptions")
              .update({
                purchased_articles_remaining: newPurchased,
              } as Database["public"]["Tables"]["company_subscriptions"]["Update"])
              .eq("id", subscription.id);

            if (updateSubError) {
              console.error(
                "[PaymentService] 更新加購篇數失敗:",
                updateSubError,
              );
              return { success: false, error: "更新加購篇數失敗" };
            }

            console.log("[PaymentService] 加購包處理成功:", {
              packageSlug: packageData.slug,
              articles: packageData.articles,
              purchasedBefore: currentPurchased,
              purchasedAfter: newPurchased,
            });
          } else {
            // 沒有活躍訂閱，創建免費訂閱並加入加購篇數
            const { data: freePlan } = await this.supabase
              .from("subscription_plans")
              .select("id")
              .eq("slug", "free")
              .single();

            if (freePlan) {
              const now = new Date();
              const { error: createSubError } = await this.supabase
                .from("company_subscriptions")
                .insert({
                  company_id: orderData.company_id,
                  plan_id: freePlan.id,
                  status: "active",
                  subscription_articles_remaining: 0,
                  purchased_articles_remaining: packageData.articles,
                  articles_per_month: 0,
                  billing_cycle: null,
                  current_period_start: now.toISOString(),
                  current_period_end: null,
                  // 向後相容必填欄位
                  monthly_token_quota: 0,
                } as unknown as Database["public"]["Tables"]["company_subscriptions"]["Insert"]);

              if (createSubError) {
                console.error(
                  "[PaymentService] 創建免費訂閱失敗:",
                  createSubError,
                );
                return { success: false, error: "創建訂閱失敗" };
              }

              console.log("[PaymentService] 創建免費訂閱並加入加購篇數:", {
                packageSlug: packageData.slug,
                articles: packageData.articles,
              });
            }
          }

          // 記錄加購篇數到 purchased_article_credits（FIFO 追蹤）
          // 暫時類型斷言（purchased_article_credits 表尚未在 database.types.ts 中）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error: creditError } = await (this.supabase as any)
            .from("purchased_article_credits")
            .insert({
              company_id: orderData.company_id,
              package_id: packageData.id,
              payment_order_id: orderData.id,
              original_credits: packageData.articles,
              remaining_credits: packageData.articles,
              expires_at: null, // 加購包永久有效
            });

          if (creditError) {
            console.error("[PaymentService] 記錄加購篇數失敗:", creditError);
            // 不返回錯誤，因為主要邏輯已完成
          }
        } else if (
          orderData.payment_type === "subscription" &&
          orderData.related_id
        ) {
          // 處理年繳訂閱（篇數制）- 預設為首次訂閱，後續會檢查是否為升級
          commissionOrderType = "subscription";

          const { data: planData, error: planError } = await this.supabase
            .from("subscription_plans")
            .select("*")
            .eq("id", orderData.related_id)
            .single();

          if (planError || !planData) {
            console.error("[PaymentService] 方案不存在:", planError);
            return { success: false, error: "方案不存在" };
          }

          // 類型斷言為篇數制方案
          const plan = planData as unknown as {
            id: string;
            name: string;
            slug: string;
            monthly_price: number;
            yearly_price: number | null;
            articles_per_month: number;
            yearly_bonus_months: number;
          };

          console.log("[PaymentService] 年繳訂閱方案資料:", {
            planId: plan.id,
            planName: plan.name,
            articlesPerMonth: plan.articles_per_month,
            yearlyBonusMonths: plan.yearly_bonus_months,
          });

          // 讀取訂單的 metadata 確認是年繳
          // 類型斷言（metadata 欄位需要在 migration 後更新類型）
          const orderMetadata = (
            orderData as unknown as {
              metadata: { billingCycle?: string } | null;
            }
          ).metadata;
          const isYearly = orderMetadata?.billingCycle === "yearly";

          if (!isYearly) {
            console.warn(
              "[PaymentService] 非年繳訂閱走到 subscription 處理，應使用 recurring",
            );
          }

          const now = new Date();
          const periodStart = now.toISOString();
          // 年繳：12 個月後到期
          const periodEnd = new Date(
            now.getFullYear() + 1,
            now.getMonth(),
            now.getDate(),
          ).toISOString();

          // 計算年繳贈送篇數（加到加購額度）
          const bonusArticles =
            plan.articles_per_month * (plan.yearly_bonus_months || 2);

          // 查詢舊訂閱
          const { data: rawOldSubscription } = await this.supabase
            .from("company_subscriptions")
            .select("id, purchased_articles_remaining")
            .eq("company_id", orderData.company_id)
            .eq("status", "active")
            .maybeSingle();

          // 類型斷言（purchased_articles_remaining 欄位尚未在 database.types.ts 中）
          const oldSubscription = rawOldSubscription as unknown as {
            id: string;
            purchased_articles_remaining: number | null;
          } | null;

          // 如果有舊訂閱，則為升級
          if (oldSubscription) {
            commissionOrderType = "upgrade";
          }

          // 保留舊的加購額度
          const preservedPurchased =
            oldSubscription?.purchased_articles_remaining || 0;
          // 新的加購額度 = 保留的 + 年繳贈送
          const newPurchasedArticles = preservedPurchased + bonusArticles;

          // 刪除舊訂閱
          if (oldSubscription) {
            await this.supabase
              .from("company_subscriptions")
              .delete()
              .eq("id", oldSubscription.id);
          }

          // 創建新的篇數制訂閱
          const { error: subscriptionError } = await this.supabase
            .from("company_subscriptions")
            .insert({
              company_id: orderData.company_id,
              plan_id: plan.id,
              status: "active",
              subscription_articles_remaining: plan.articles_per_month,
              purchased_articles_remaining: newPurchasedArticles,
              articles_per_month: plan.articles_per_month,
              billing_cycle: "yearly",
              current_period_start: periodStart,
              current_period_end: periodEnd,
              last_quota_reset_at: periodStart,
              // 向後相容必填欄位
              monthly_token_quota: 0,
            } as unknown as Database["public"]["Tables"]["company_subscriptions"]["Insert"]);

          if (subscriptionError) {
            console.error(
              "[PaymentService] 創建年繳訂閱失敗:",
              subscriptionError,
            );
            return { success: false, error: "創建訂閱失敗" };
          }

          // 更新公司的訂閱層級
          const tier = this.mapPlanSlugToTier(plan.slug);
          const { error: companyUpdateError } = await this.supabase
            .from("companies")
            .update({
              subscription_tier: tier,
              subscription_ends_at: periodEnd,
              updated_at: now.toISOString(),
            })
            .eq("id", orderData.company_id);

          if (companyUpdateError) {
            console.error(
              "[PaymentService] 更新公司訂閱資料失敗:",
              companyUpdateError,
            );
          }

          // 如果有年繳贈送，記錄到 purchased_article_credits（FIFO 追蹤）
          if (bonusArticles > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { error: creditError } = await (this.supabase as any)
              .from("purchased_article_credits")
              .insert({
                company_id: orderData.company_id,
                package_id: null, // 年繳贈送，沒有 package_id
                payment_order_id: orderData.id,
                original_credits: bonusArticles,
                remaining_credits: bonusArticles,
                expires_at: null, // 贈送篇數永久有效
              });

            if (creditError) {
              console.error(
                "[PaymentService] 記錄年繳贈送篇數失敗:",
                creditError,
              );
            }
          }

          console.log("[PaymentService] 年繳訂閱處理成功:", {
            planName: plan.name,
            tier,
            articlesPerMonth: plan.articles_per_month,
            bonusArticles,
            preservedPurchased,
            totalPurchased: newPurchasedArticles,
            periodEnd,
          });
        } else if (
          orderData.payment_type === "lifetime" &&
          orderData.related_id
        ) {
          // 終身方案 - 預設為首次訂閱，後續會檢查是否為升級
          commissionOrderType = "subscription";

          const { data: planData, error: planError } = await this.supabase
            .from("subscription_plans")
            .select<
              "*",
              Database["public"]["Tables"]["subscription_plans"]["Row"]
            >("*")
            .eq("id", orderData.related_id)
            .single();

          if (planError || !planData) {
            console.error("[PaymentService] 終身方案不存在:", planError);
            return { success: false, error: "終身方案不存在" };
          }

          const tier = this.mapPlanSlugToTier(planData.slug);

          const { error: updateError } = await this.supabase
            .from("companies")
            .update({
              subscription_tier: tier,
              subscription_ends_at: null,
            })
            .eq("id", orderData.company_id);

          if (updateError) {
            console.error("[PaymentService] 更新終身訂閱失敗:", updateError);
            return { success: false, error: "更新終身訂閱失敗" };
          }

          const now = new Date();
          const periodStart = now.toISOString();
          const nextMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            now.getDate(),
          );
          const periodEnd = nextMonth.toISOString();

          // 檢查是否已有相同方案的訂閱（疊加購買）
          const { data: existingSubscription } = await this.supabase
            .from("company_subscriptions")
            .select(
              "id, plan_id, purchased_token_balance, monthly_token_quota, monthly_quota_balance",
            )
            .eq("company_id", orderData.company_id)
            .eq("plan_id", planData.id)
            .eq("status", "active")
            .maybeSingle();

          if (existingSubscription) {
            // 疊加購買也算升級（追加購買同方案）
            commissionOrderType = "upgrade";

            // 疊加購買：累加配額（每次購買增加基礎配額）
            const currentQuota =
              existingSubscription.monthly_token_quota || planData.base_tokens;
            const newMonthlyQuota = currentQuota + planData.base_tokens;
            // 剩餘配額 + 新購買配額
            const currentQuotaBalance =
              existingSubscription.monthly_quota_balance || 0;
            const newQuotaBalance = currentQuotaBalance + planData.base_tokens;

            const { error: stackError } = await this.supabase
              .from("company_subscriptions")
              .update({
                monthly_token_quota: newMonthlyQuota,
                monthly_quota_balance: newQuotaBalance,
                // 不更新 current_period_start，保留原始重置日期
                current_period_end: periodEnd,
              })
              .eq("id", existingSubscription.id);

            if (stackError) {
              console.error("[PaymentService] 疊加訂閱失敗:", stackError);
              return { success: false, error: "疊加訂閱失敗" };
            }

            console.log("[PaymentService] 終身方案疊加購買成功:", {
              planName: planData.name,
              planSlug: planData.slug,
              tier,
              companyId: orderData.company_id,
              previousQuota: currentQuota,
              newMonthlyTokenQuota: newMonthlyQuota,
              previousQuotaBalance: currentQuotaBalance,
              newQuotaBalance,
              periodEnd,
            });
          } else {
            // 首次購買或購買不同方案
            // 【重要】：需要檢查是否為降級，防止高階方案被低階方案覆蓋
            const { data: oldSubscription } = await this.supabase
              .from("company_subscriptions")
              .select(
                "id, plan_id, purchased_token_balance, monthly_token_quota, monthly_quota_balance, current_period_start",
              )
              .eq("company_id", orderData.company_id)
              .eq("status", "active")
              .maybeSingle();

            // 獲取舊方案的 tier 等級
            let oldTierLevel = 0;
            if (oldSubscription?.plan_id) {
              const { data: oldPlan } = await this.supabase
                .from("subscription_plans")
                .select("slug")
                .eq("id", oldSubscription.plan_id)
                .single();
              if (oldPlan?.slug) {
                oldTierLevel = TIER_HIERARCHY[oldPlan.slug] ?? 0;
              }
            }

            // 獲取新方案的 tier 等級
            const newTierLevel = TIER_HIERARCHY[planData.slug] ?? 0;

            console.log("[PaymentService] 方案等級比較:", {
              oldTierLevel,
              newTierLevel,
              oldPlanId: oldSubscription?.plan_id,
              newPlanSlug: planData.slug,
              isDowngrade: newTierLevel < oldTierLevel,
            });

            // 如果有舊訂閱，則為升級（無論方案等級高低）
            if (oldSubscription) {
              commissionOrderType = "upgrade";
            }

            // 【關鍵修復】：如果是降級，只累加 tokens，不更換方案
            if (oldSubscription && newTierLevel < oldTierLevel) {
              console.warn(
                `[PaymentService] 拒絕降級：保持原方案，只累加 tokens`,
              );

              const currentQuotaBalance =
                oldSubscription.monthly_quota_balance || 0;
              const newQuotaBalance =
                currentQuotaBalance + planData.base_tokens;
              const currentMonthlyQuota =
                oldSubscription.monthly_token_quota || 0;
              const newMonthlyQuota =
                currentMonthlyQuota + planData.base_tokens;

              const { error: stackError } = await this.supabase
                .from("company_subscriptions")
                .update({
                  monthly_quota_balance: newQuotaBalance,
                  monthly_token_quota: newMonthlyQuota,
                  current_period_end: periodEnd,
                })
                .eq("id", oldSubscription.id);

              if (stackError) {
                console.error("[PaymentService] 累加 tokens 失敗:", stackError);
                return { success: false, error: "累加 tokens 失敗" };
              }

              console.log("[PaymentService] 購買低階方案，只累加 tokens:", {
                purchasedPlanName: planData.name,
                purchasedPlanSlug: planData.slug,
                keptOldPlanId: oldSubscription.plan_id,
                previousQuotaBalance: currentQuotaBalance,
                addedTokens: planData.base_tokens,
                newQuotaBalance,
              });
            } else {
              // 升級或首次購買：正常流程
              const preservedPurchasedBalance =
                oldSubscription?.purchased_token_balance || 0;

              // 保留並累加配額（跨方案升級不丟失配額）
              const previousMonthlyQuota =
                oldSubscription?.monthly_token_quota || 0;
              const previousQuotaBalance =
                oldSubscription?.monthly_quota_balance || 0;
              const newMonthlyQuota =
                previousMonthlyQuota + planData.base_tokens;
              const newQuotaBalance =
                previousQuotaBalance + planData.base_tokens;

              // 保留原始週期開始時間（如果存在）
              const preservedPeriodStart =
                oldSubscription?.current_period_start || periodStart;

              console.log("[PaymentService] 跨方案升級配額保留:", {
                previousMonthlyQuota,
                previousQuotaBalance,
                newPlanBaseTokens: planData.base_tokens,
                newMonthlyQuota,
                newQuotaBalance,
                preservedPurchasedBalance,
              });

              await this.supabase
                .from("company_subscriptions")
                .delete()
                .eq("company_id", orderData.company_id);

              const { error: subscriptionError } = await this.supabase
                .from("company_subscriptions")
                .insert({
                  company_id: orderData.company_id,
                  plan_id: planData.id,
                  status: "active",
                  purchased_token_balance: preservedPurchasedBalance,
                  monthly_quota_balance: newQuotaBalance,
                  monthly_token_quota: newMonthlyQuota,
                  base_monthly_quota: planData.base_tokens,
                  purchased_count: 1,
                  is_lifetime: true,
                  lifetime_discount: 1.0,
                  current_period_start: preservedPeriodStart,
                  current_period_end: periodEnd,
                });

              if (subscriptionError) {
                console.error(
                  "[PaymentService] 創建終身訂閱記錄失敗:",
                  subscriptionError,
                );
              }

              console.log("[PaymentService] 終身方案購買成功:", {
                planName: planData.name,
                planSlug: planData.slug,
                tier,
                companyId: orderData.company_id,
                purchasedCount: 1,
                monthlyTokenQuota: planData.base_tokens,
                periodEnd,
              });
            }
          }
        }

        // 呼叫新的 Affiliate System 記錄佣金
        createCommission({
          referredUserId: orderData.company_id,
          externalOrderId: orderData.id,
          orderAmount: orderData.amount,
          orderType: commissionOrderType,
        }).catch((error) => {
          console.error(
            "[PaymentService] Affiliate 佣金記錄失敗（不影響付款流程）:",
            error,
          );
        });

        console.log("[PaymentService] 佣金類型:", commissionOrderType);

        // 同步用戶到 Brevo（訂閱變更後觸發分群更新）
        syncCompanyOwnerToBrevo(orderData.company_id).catch((error) => {
          console.error(
            "[PaymentService] Brevo 同步失敗（不影響付款流程）:",
            error,
          );
        });

        return { success: true };
      } else {
        // 付款失敗
        const { error: updateError } = await this.supabase
          .from("payment_orders")
          .update({
            status: "failed",
            newebpay_status: status,
            newebpay_message: errorMessage || "付款失敗",
            newebpay_response:
              webhookData as unknown as Database["public"]["Tables"]["payment_orders"]["Update"]["newebpay_response"],
            failed_at: new Date().toISOString(),
            failure_reason: errorMessage || "付款失敗",
          })
          .eq("id", orderData.id);

        if (updateError) {
          console.error("[PaymentService] 更新訂單狀態失敗:", updateError);
        }

        return { success: false, error: errorMessage || "付款失敗" };
      }
    } catch (error) {
      console.error("[PaymentService] 處理回調失敗:", error);
      return { success: false, error: "處理回調失敗" };
    }
  }

  /**
   * 處理定期定額回調
   *
   * 接收來自 PAYUNi webhook 的已解密資料
   */
  async handleRecurringCallback(webhookData: PayUniWebhookData): Promise<{
    success: boolean;
    error?: string;
    warnings?: string[];
  }> {
    try {
      const {
        orderId: mandateNo,
        status,
        periodTradeNo,
        currentPeriod,
        errorMessage,
      } = webhookData;

      console.log("[PaymentService] 處理 PAYUNi 定期定額通知:", {
        mandateNo,
        status,
        periodTradeNo,
        currentPeriod,
      });

      let mandateData:
        | Database["public"]["Tables"]["recurring_mandates"]["Row"]
        | null = null;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= 10; attempt++) {
        console.log(`[PaymentService] 查詢委託嘗試 ${attempt}/10`);

        const { data, error } = await this.supabase
          .from("recurring_mandates")
          .select<
            "*",
            Database["public"]["Tables"]["recurring_mandates"]["Row"]
          >("*")
          .eq("mandate_no", mandateNo)
          .maybeSingle();

        console.log(`[PaymentService] 查詢結果 (嘗試 ${attempt}/10):`, {
          mandateNo,
          hasData: !!data,
          error: error?.message || null,
          errorCode: error?.code || null,
        });

        if (data && !error) {
          mandateData = data;
          lastError = null;
          console.log(`[PaymentService] 找到委託 (嘗試 ${attempt}/10):`, {
            mandateId: data.id,
            mandateNo: data.mandate_no,
            currentStatus: data.status,
          });
          break;
        }

        lastError = error;
        console.log(`[PaymentService] 查詢失敗 (嘗試 ${attempt}/10):`, {
          mandateNo,
          error,
        });

        if (attempt < 10) {
          const delay = Math.min(1000 * attempt, 3000);
          console.log(`[PaymentService] 等待 ${delay}ms 後重試`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!mandateData) {
        console.error("[PaymentService] 重試 10 次後仍找不到定期定額委託");
        console.error("[PaymentService] mandate_no:", mandateNo);
        console.error("[PaymentService] 最後錯誤:", lastError);
        console.error(
          "[PaymentService] 完整 webhook 資料:",
          JSON.stringify(webhookData, null, 2),
        );

        const { data: allMandates } = await this.supabase
          .from("recurring_mandates")
          .select("mandate_no, id, status, created_at")
          .order("created_at", { ascending: false })
          .limit(10);

        console.error("[PaymentService] 最近 10 筆 mandates:", allMandates);

        return { success: false, error: "找不到定期定額委託" };
      }

      // PAYUNi status: "SUCCESS" | "FAILED" | "PENDING"
      if (status === "SUCCESS") {
        const isFirstAuthorization = mandateData.status === "pending";
        const isRecurringBilling = mandateData.status === "active";

        // 追蹤佣金類型：首次訂閱、升級、或續約
        let commissionOrderType: "subscription" | "upgrade" | "renewal" =
          isRecurringBilling ? "renewal" : "subscription";

        console.log("[PaymentService] 開始處理授權成功邏輯:", {
          isFirstAuthorization,
          isRecurringBilling,
          currentStatus: mandateData.status,
        });

        let authorizationSuccess = false;
        const businessLogicErrors: string[] = [];

        const mandateUpdate: Database["public"]["Tables"]["recurring_mandates"]["Update"] =
          {
            newebpay_response:
              webhookData as unknown as Database["public"]["Tables"]["payment_orders"]["Update"]["newebpay_response"],
            next_payment_date: this.calculateNextPaymentDate(
              mandateData.period_type,
              mandateData.period_point || undefined,
            ),
          };

        if (isFirstAuthorization) {
          mandateUpdate.status = "active";
          mandateUpdate.newebpay_period_no = periodTradeNo || "";
          mandateUpdate.activated_at = new Date().toISOString();
          mandateUpdate.periods_paid = 1;
        } else if (isRecurringBilling) {
          mandateUpdate.periods_paid = (mandateData.periods_paid || 0) + 1;
        }

        const { error: updateError } = await this.supabase
          .from("recurring_mandates")
          .update(mandateUpdate)
          .eq("id", mandateData.id);

        if (updateError) {
          console.error(
            "[PaymentService] ❌ 更新定期定額委託失敗:",
            updateError,
          );
          businessLogicErrors.push("更新委託狀態失敗");
        } else {
          console.log("[PaymentService] ✅ 委託狀態已更新為 active");
          authorizationSuccess = true;
        }

        if (mandateData.first_payment_order_id) {
          const { error: orderUpdateError } = await this.supabase
            .from("payment_orders")
            .update({
              status: "success",
              newebpay_status: status,
              newebpay_response:
                webhookData as unknown as Database["public"]["Tables"]["payment_orders"]["Update"]["newebpay_response"],
              paid_at: new Date().toISOString(),
            })
            .eq("id", mandateData.first_payment_order_id);

          if (orderUpdateError) {
            console.error(
              "[PaymentService] ❌ 更新訂單狀態失敗:",
              orderUpdateError,
            );
            businessLogicErrors.push("更新訂單狀態失敗");
          } else {
            console.log("[PaymentService] ✅ 訂單狀態已更新為 success");
          }
        }

        const { data: planData, error: planError } = await this.supabase
          .from("subscription_plans")
          .select<
            "*",
            Database["public"]["Tables"]["subscription_plans"]["Row"]
          >("*")
          .eq("id", mandateData.plan_id)
          .single();

        if (planError || !planData) {
          console.error("[PaymentService] ❌ 查詢方案失敗:", planError);
          businessLogicErrors.push("查詢方案失敗");
        } else {
          const now = new Date();
          const periodStart = now.toISOString();
          const periodEnd = new Date(
            now.getFullYear() + 1,
            now.getMonth(),
            now.getDate(),
          ).toISOString();

          // 查詢舊的訂閱記錄，保留所有配額（包括 purchased_token_balance、purchased_articles_remaining 和累積配額）
          const { data: rawOldSubscription } = await this.supabase
            .from("company_subscriptions")
            .select(
              "id, plan_id, purchased_token_balance, monthly_token_quota, monthly_quota_balance, purchased_articles_remaining",
            )
            .eq("company_id", mandateData.company_id)
            .eq("status", "active")
            .single();

          // 類型斷言（purchased_articles_remaining 欄位尚未在 database.types.ts 中）
          const oldSubscription = rawOldSubscription as unknown as {
            id: string;
            plan_id: string | null;
            purchased_token_balance: number | null;
            monthly_token_quota: number | null;
            monthly_quota_balance: number | null;
            purchased_articles_remaining: number | null;
          } | null;

          // 獲取舊方案的 tier 等級
          let oldTierLevel = 0;
          if (oldSubscription?.plan_id) {
            const { data: oldPlan } = await this.supabase
              .from("subscription_plans")
              .select("slug")
              .eq("id", oldSubscription.plan_id)
              .single();
            if (oldPlan?.slug) {
              oldTierLevel = TIER_HIERARCHY[oldPlan.slug] ?? 0;
            }
          }

          // 獲取新方案的 tier 等級
          const newTierLevel = TIER_HIERARCHY[planData.slug] ?? 0;

          console.log("[PaymentService] 定期定額方案等級比較:", {
            oldTierLevel,
            newTierLevel,
            oldPlanId: oldSubscription?.plan_id,
            newPlanSlug: planData.slug,
            isDowngrade: newTierLevel < oldTierLevel,
          });

          // 如果是首次授權且有舊訂閱，則為升級
          if (isFirstAuthorization && oldSubscription) {
            commissionOrderType = "upgrade";
          }

          // 定義在 if/else 外部，供後續使用
          const preservedPurchasedBalance =
            oldSubscription?.purchased_token_balance || 0;

          // 【關鍵修復】：如果是降級，只累加 tokens，不更換方案
          if (oldSubscription && newTierLevel < oldTierLevel) {
            console.warn(
              `[PaymentService] 定期定額拒絕降級：保持原方案，只累加 tokens`,
            );

            const currentQuotaBalance =
              oldSubscription.monthly_quota_balance || 0;
            const newQuotaBalance = currentQuotaBalance + planData.base_tokens;
            const currentMonthlyQuota =
              oldSubscription.monthly_token_quota || 0;
            const newMonthlyQuota = currentMonthlyQuota + planData.base_tokens;

            const { error: stackError } = await this.supabase
              .from("company_subscriptions")
              .update({
                monthly_quota_balance: newQuotaBalance,
                monthly_token_quota: newMonthlyQuota,
                current_period_end: periodEnd,
              })
              .eq("id", oldSubscription.id);

            if (stackError) {
              console.error(
                "[PaymentService] 定期定額累加 tokens 失敗:",
                stackError,
              );
              businessLogicErrors.push("累加 tokens 失敗");
            } else {
              console.log(
                "[PaymentService] 定期定額購買低階方案，只累加 tokens:",
                {
                  purchasedPlanSlug: planData.slug,
                  keptOldPlanId: oldSubscription.plan_id,
                  addedTokens: planData.base_tokens,
                  newQuotaBalance,
                },
              );
            }
          } else {
            // 升級或首次購買：正常流程
            // 保留並累加配額（從終身方案轉換或續約時不丟失配額）
            const previousMonthlyQuota =
              oldSubscription?.monthly_token_quota || 0;
            const previousQuotaBalance =
              oldSubscription?.monthly_quota_balance || 0;
            const newMonthlyQuota = previousMonthlyQuota + planData.base_tokens;
            const newQuotaBalance = previousQuotaBalance + planData.base_tokens;

            console.log("[PaymentService] 定期定額訂閱配額保留:", {
              previousMonthlyQuota,
              previousQuotaBalance,
              newPlanBaseTokens: planData.base_tokens,
              newMonthlyQuota,
              newQuotaBalance,
              preservedPurchasedBalance,
            });

            // 保留舊訂閱的加購篇數（在刪除前取得）
            const preservedPurchasedArticles =
              oldSubscription?.purchased_articles_remaining || 0;

            // 刪除該公司的所有舊訂閱記錄
            await this.supabase
              .from("company_subscriptions")
              .delete()
              .eq("company_id", mandateData.company_id);

            // 類型斷言取得篇數制方案欄位
            const planWithArticles = planData as unknown as {
              articles_per_month?: number;
            };
            const articlesPerMonth = planWithArticles.articles_per_month || 0;

            // 月繳週期結束日：下個月同一天
            const monthlyPeriodEnd = new Date(
              now.getFullYear(),
              now.getMonth() + 1,
              now.getDate(),
            ).toISOString();

            // 創建新的訂閱記錄，同時支援 Token 制和篇數制
            const { error: subscriptionError } = await this.supabase
              .from("company_subscriptions")
              .insert({
                company_id: mandateData.company_id,
                plan_id: mandateData.plan_id,
                status: "active",
                // Token 制欄位（向後相容）
                purchased_token_balance: preservedPurchasedBalance,
                monthly_quota_balance: newQuotaBalance,
                monthly_token_quota: newMonthlyQuota,
                // 篇數制欄位
                subscription_articles_remaining: articlesPerMonth,
                purchased_articles_remaining: preservedPurchasedArticles,
                articles_per_month: articlesPerMonth,
                billing_cycle: "monthly",
                last_quota_reset_at: periodStart,
                // 共用欄位
                is_lifetime: false,
                lifetime_discount: 1.0,
                current_period_start: periodStart,
                current_period_end: monthlyPeriodEnd, // 月繳用月週期
              } as Database["public"]["Tables"]["company_subscriptions"]["Insert"]);

            if (subscriptionError) {
              console.error(
                "[PaymentService] ❌ 創建訂閱失敗:",
                subscriptionError,
              );
              businessLogicErrors.push("創建訂閱失敗");
            } else {
              console.log("[PaymentService] ✅ 訂閱已創建");
            }
          }

          // 更新公司的訂閱層級和到期時間
          const subscriptionTier = this.mapPlanSlugToTier(planData.slug);
          const subscriptionEndsAt =
            mandateData.period_type === "M"
              ? this.calculateNextPaymentDate(
                  mandateData.period_type,
                  mandateData.period_point || undefined,
                )
              : mandateData.period_type === "Y"
                ? new Date(
                    now.getFullYear() + 1,
                    now.getMonth(),
                    now.getDate(),
                  ).toISOString()
                : periodEnd;

          const { error: companyUpdateError } = await this.supabase
            .from("companies")
            .update({
              subscription_tier: subscriptionTier,
              subscription_ends_at: subscriptionEndsAt,
              updated_at: now.toISOString(),
            })
            .eq("id", mandateData.company_id);

          if (companyUpdateError) {
            console.error(
              "[PaymentService] ❌ 更新公司訂閱資料失敗:",
              companyUpdateError,
            );
            businessLogicErrors.push("更新公司訂閱資料失敗");
          } else {
            console.log("[PaymentService] ✅ 公司訂閱資料已更新:", {
              subscription_tier: subscriptionTier,
              subscription_ends_at: subscriptionEndsAt,
            });
          }

          // 記錄月配額的獲得（首次訂閱或續約）
          const description = isFirstAuthorization
            ? `訂閱 ${planData.name} 方案（首次授權）- 月配額 ${planData.base_tokens?.toLocaleString()} Tokens`
            : `定期定額扣款 - ${planData.name} 方案（第 ${mandateUpdate.periods_paid} 期）- 月配額 ${planData.base_tokens?.toLocaleString()} Tokens`;

          // 計算總餘額（月配額 + 購買配額）
          const totalBalance = planData.base_tokens + preservedPurchasedBalance;

          const { error: tokenError } = await this.supabase
            .from("token_balance_changes")
            .insert({
              company_id: mandateData.company_id,
              change_type: isFirstAuthorization
                ? "subscription"
                : "quota_renewal",
              amount: planData.base_tokens,
              balance_before: preservedPurchasedBalance,
              balance_after: totalBalance,
              description,
            });

          if (tokenError) {
            console.error("[PaymentService] ❌ 添加代幣記錄失敗:", tokenError);
            businessLogicErrors.push("添加代幣記錄失敗");
          } else {
            console.log("[PaymentService] ✅ 代幣記錄已添加");
          }
        }

        if (businessLogicErrors.length > 0) {
          console.warn(
            "[PaymentService] ⚠️ 授權成功但部分業務邏輯失敗:",
            businessLogicErrors,
          );
          if (!authorizationSuccess) {
            return {
              success: false,
              error: "授權處理失敗: " + businessLogicErrors.join(", "),
            };
          }
        }

        // 呼叫新的 Affiliate System 記錄佣金
        createCommission({
          referredUserId: mandateData.company_id,
          externalOrderId:
            mandateData.first_payment_order_id || `mandate-${mandateData.id}`,
          orderAmount: mandateData.period_amount,
          orderType: commissionOrderType,
        }).catch((error) => {
          console.error(
            "[PaymentService] Affiliate 佣金記錄失敗（不影響付款流程）:",
            error,
          );
        });

        console.log("[PaymentService] 佣金類型:", commissionOrderType);

        // 同步用戶到 Brevo（訂閱變更後觸發分群更新）
        syncCompanyOwnerToBrevo(mandateData.company_id).catch((error) => {
          console.error(
            "[PaymentService] Brevo 同步失敗（不影響付款流程）:",
            error,
          );
        });

        console.log("[PaymentService] ✅ 授權成功處理完成");
        return {
          success: true,
          warnings:
            businessLogicErrors.length > 0 ? businessLogicErrors : undefined,
        };
      } else {
        // 定期定額失敗
        await this.supabase
          .from("recurring_mandates")
          .update({
            status: "failed",
            newebpay_response:
              webhookData as unknown as Database["public"]["Tables"]["payment_orders"]["Update"]["newebpay_response"],
          })
          .eq("id", mandateData.id);

        return { success: false, error: errorMessage || "定期定額付款失敗" };
      }
    } catch (error) {
      console.error("[PaymentService] 處理定期定額回調失敗:", error);
      return { success: false, error: "處理定期定額回調失敗" };
    }
  }

  private calculateNextPaymentDate(
    periodType: "D" | "W" | "M" | "Y",
    periodPoint?: string,
  ): string {
    const now = new Date();

    if (periodType === "M") {
      const targetDay = periodPoint ? parseInt(periodPoint) : now.getDate();
      const nextMonth = now.getMonth() + 1;
      const nextYear =
        nextMonth > 11 ? now.getFullYear() + 1 : now.getFullYear();
      const actualMonth = nextMonth > 11 ? 0 : nextMonth;

      const lastDayOfNextMonth = new Date(
        nextYear,
        actualMonth + 1,
        0,
      ).getDate();
      const actualDay = Math.min(targetDay, lastDayOfNextMonth);

      const nextDate = new Date(nextYear, actualMonth, actualDay, 0, 0, 0, 0);
      return nextDate.toISOString();
    }

    switch (periodType) {
      case "Y":
        const [month, dayOfMonth] = periodPoint
          ? periodPoint.split(",").map(Number)
          : [now.getMonth() + 1, now.getDate()];
        const nextYear = new Date(now.getFullYear() + 1, month - 1, dayOfMonth);
        return nextYear.toISOString().split("T")[0];

      case "W":
        const weekday = periodPoint ? parseInt(periodPoint) : now.getDay();
        const daysUntilNext = (weekday + 7 - now.getDay()) % 7 || 7;
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + daysUntilNext);
        return nextWeek.toISOString().split("T")[0];

      case "D":
        const nextDay = new Date(now);
        nextDay.setDate(now.getDate() + 1);
        return nextDay.toISOString().split("T")[0];

      default:
        return now.toISOString().split("T")[0];
    }
  }

  /**
   * 建立 PaymentService 實例
   */
  static createInstance(
    supabase: ReturnType<typeof createClient<Database>>,
  ): PaymentService {
    return new PaymentService(supabase);
  }
}
