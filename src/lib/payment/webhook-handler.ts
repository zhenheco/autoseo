/**
 * 金流微服務 Webhook 處理器
 *
 * 處理從金流微服務發送的付款結果通知。
 * 金流微服務已經完成藍新金流的加解密，這裡只需要：
 * 1. 驗證 Webhook 簽名
 * 2. 解析事件內容
 * 3. 執行業務邏輯（更新訂單、增加代幣等）
 */

import { createAdminClient } from "@/lib/supabase/server";
import {
  parseWebhookEvent,
  type WebhookEvent,
  PaymentGatewayError,
} from "./gateway-client";

// ============================================================================
// 類型定義
// ============================================================================

export interface WebhookHandlerResult {
  received: boolean;
  error?: string;
  paymentId?: string;
  orderId?: string;
}

// ============================================================================
// Webhook 處理主函數
// ============================================================================

/**
 * 處理金流微服務 Webhook
 *
 * @param rawBody 原始請求 body（JSON 字串）
 * @param signature X-Webhook-Signature header 值
 * @returns 處理結果
 */
export async function handleGatewayWebhook(
  rawBody: string,
  signature: string | null,
): Promise<WebhookHandlerResult> {
  console.log("[GatewayWebhook] 收到 Webhook 請求");

  try {
    // 1. 驗證簽名並解析事件
    const event = await parseWebhookEvent(rawBody, signature);

    console.log("[GatewayWebhook] Webhook 事件:", {
      paymentId: event.paymentId,
      orderId: event.orderId,
      status: event.status,
      amount: event.amount,
    });

    // 2. 根據狀態處理
    switch (event.status) {
      case "SUCCESS":
        await handlePaymentSuccess(event);
        break;
      case "FAILED":
        await handlePaymentFailed(event);
        break;
      case "CANCELLED":
        await handlePaymentCancelled(event);
        break;
      case "REFUNDED":
        await handlePaymentRefunded(event);
        break;
      default:
        console.warn("[GatewayWebhook] 未知的付款狀態:", event.status);
    }

    return {
      received: true,
      paymentId: event.paymentId,
      orderId: event.orderId,
    };
  } catch (error) {
    console.error("[GatewayWebhook] 處理失敗:", error);

    if (error instanceof PaymentGatewayError) {
      return {
        received: false,
        error: error.message,
      };
    }

    return {
      received: false,
      error: error instanceof Error ? error.message : "未知錯誤",
    };
  }
}

// ============================================================================
// 業務邏輯處理
// ============================================================================

/**
 * 處理付款成功
 */
async function handlePaymentSuccess(event: WebhookEvent): Promise<void> {
  console.log("[GatewayWebhook] 處理付款成功:", event.orderId);

  const supabase = createAdminClient();

  // 從 orderId 提取訂單編號
  // 金流微服務的 orderId 格式是我們傳入的，需要與 payment_orders 表對應
  const orderNo = event.orderId;

  // 查詢訂單（加入重試機制，應對 Supabase 複製延遲）
  let orderData: Record<string, unknown> | null = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    const { data, error } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("order_no", orderNo)
      .maybeSingle();

    if (data && !error) {
      orderData = data;
      console.log(`[GatewayWebhook] 成功找到訂單 (第 ${attempt} 次嘗試)`);
      break;
    }

    if (attempt < 10) {
      const delay = Math.min(500 * attempt, 2000);
      console.log(`[GatewayWebhook] 等待 ${delay}ms 後重試`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  if (!orderData) {
    console.error("[GatewayWebhook] 找不到訂單:", orderNo);
    throw new Error(`找不到訂單: ${orderNo}`);
  }

  // 檢查是否已處理過
  if (orderData.status === "success") {
    console.log("[GatewayWebhook] 訂單已處理過，跳過:", orderNo);
    return;
  }

  // 更新訂單狀態
  const { error: updateError } = await supabase
    .from("payment_orders")
    .update({
      status: "success",
      newebpay_status: "SUCCESS",
      newebpay_trade_no: event.newebpayTradeNo,
      paid_at: event.paidAt || new Date().toISOString(),
      newebpay_response: {
        source: "gateway_webhook",
        paymentId: event.paymentId,
        metadata: event.metadata,
      },
    })
    .eq("id", orderData.id);

  if (updateError) {
    console.error("[GatewayWebhook] 更新訂單狀態失敗:", updateError);
    throw new Error("更新訂單狀態失敗");
  }

  console.log("[GatewayWebhook] 訂單狀態已更新為成功");

  // 執行後續業務邏輯
  await processPaymentBusinessLogic(orderData, event);
}

/**
 * 處理付款失敗
 */
async function handlePaymentFailed(event: WebhookEvent): Promise<void> {
  console.log("[GatewayWebhook] 處理付款失敗:", event.orderId);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("payment_orders")
    .update({
      status: "failed",
      newebpay_status: "FAILED",
      failure_reason: event.errorMessage,
      failed_at: new Date().toISOString(),
    })
    .eq("order_no", event.orderId);

  if (error) {
    console.error("[GatewayWebhook] 更新訂單狀態失敗:", error);
  }
}

/**
 * 處理付款取消
 */
async function handlePaymentCancelled(event: WebhookEvent): Promise<void> {
  console.log("[GatewayWebhook] 處理付款取消:", event.orderId);

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("payment_orders")
    .update({
      status: "failed",
      newebpay_status: "CANCELLED",
      failure_reason: "用戶取消付款",
      failed_at: new Date().toISOString(),
    })
    .eq("order_no", event.orderId);

  if (error) {
    console.error("[GatewayWebhook] 更新訂單狀態失敗:", error);
  }
}

/**
 * 處理退款（目前暫不支援）
 */
async function handlePaymentRefunded(event: WebhookEvent): Promise<void> {
  console.log("[GatewayWebhook] 收到退款通知（暫不處理）:", event.orderId);
  // 退款功能暫時停用
}

// ============================================================================
// 業務邏輯
// ============================================================================

/**
 * 執行付款成功後的業務邏輯
 *
 * 根據 payment_type 執行不同的處理：
 * - token_package: 增加代幣
 * - subscription: 建立訂閱
 * - lifetime: 升級終身方案
 * - article_package: 添加加購篇數
 */
async function processPaymentBusinessLogic(
  orderData: Record<string, unknown>,
  event: WebhookEvent,
): Promise<void> {
  const paymentType = orderData.payment_type as string;
  const companyId = orderData.company_id as string;
  const relatedId = orderData.related_id as string | null;
  const amount = orderData.amount as number;

  console.log("[GatewayWebhook] 執行業務邏輯:", {
    paymentType,
    companyId,
    relatedId,
  });

  const supabase = createAdminClient();

  switch (paymentType) {
    case "token_package":
      if (relatedId) {
        await handleTokenPackagePurchase(supabase, companyId, relatedId);
      }
      break;

    case "subscription":
      if (relatedId) {
        await handleSubscriptionPurchase(
          supabase,
          companyId,
          relatedId,
          orderData,
        );
      }
      break;

    case "lifetime":
      await handleLifetimePurchase(supabase, companyId, amount);
      break;

    case "article_package":
      if (relatedId) {
        await handleArticlePackagePurchase(supabase, companyId, relatedId);
      }
      break;

    default:
      console.warn("[GatewayWebhook] 未知的付款類型:", paymentType);
  }

  // 建立佣金記錄（異步，不阻塞）
  createCommissionAsync(orderData, event).catch((err) => {
    console.error("[GatewayWebhook] 建立佣金失敗:", err);
  });

  // 同步到 CRM（異步，不阻塞）
  syncToCrmAsync(companyId).catch((err) => {
    console.error("[GatewayWebhook] 同步 CRM 失敗:", err);
  });
}

/**
 * 處理代幣包購買
 */
async function handleTokenPackagePurchase(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  packageId: string,
): Promise<void> {
  console.log("[GatewayWebhook] 處理代幣包購買:", { companyId, packageId });

  // 查詢代幣包
  const { data: packageData, error: packageError } = await supabase
    .from("token_packages")
    .select("*")
    .eq("id", packageId)
    .single();

  if (packageError || !packageData) {
    console.error("[GatewayWebhook] 找不到代幣包:", packageId);
    return;
  }

  const tokenAmount = packageData.token_amount as number;

  // 增加公司代幣餘額
  const { error: updateError } = await supabase.rpc(
    "increment_company_tokens",
    {
      p_company_id: companyId,
      p_token_amount: tokenAmount,
    },
  );

  if (updateError) {
    console.error("[GatewayWebhook] 增加代幣失敗:", updateError);
    return;
  }

  console.log("[GatewayWebhook] 代幣已增加:", { companyId, tokenAmount });
}

/**
 * 處理訂閱購買
 *
 * 更新或建立公司訂閱，設定訂閱額度和週期。
 */
async function handleSubscriptionPurchase(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  planId: string,
  orderData: Record<string, unknown>,
): Promise<void> {
  console.log("[GatewayWebhook] 處理訂閱購買:", { companyId, planId });

  // 查詢訂閱方案
  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    console.error("[GatewayWebhook] 找不到訂閱方案:", planId);
    return;
  }

  const articlesPerMonth = plan.articles_per_month as number;
  const planName = plan.name as string;

  // 計算訂閱週期
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // 檢查是否已有訂閱
  const { data: existingSub } = await supabase
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (existingSub) {
    // 更新現有訂閱
    const currentArticles =
      (existingSub.subscription_articles_remaining as number) || 0;
    const newArticles = currentArticles + articlesPerMonth;

    const { error: updateError } = await supabase
      .from("company_subscriptions")
      .update({
        plan_id: planId,
        status: "active",
        subscription_articles_remaining: newArticles,
        articles_per_month: articlesPerMonth,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        last_quota_reset_at: now.toISOString(),
      })
      .eq("id", existingSub.id);

    if (updateError) {
      console.error("[GatewayWebhook] 更新訂閱失敗:", updateError);
      return;
    }

    console.log("[GatewayWebhook] 訂閱已更新:", {
      planName,
      articlesAdded: articlesPerMonth,
      totalArticles: newArticles,
    });
  } else {
    // 建立新訂閱
    const { error: insertError } = await supabase
      .from("company_subscriptions")
      .insert({
        company_id: companyId,
        plan_id: planId,
        status: "active",
        subscription_articles_remaining: articlesPerMonth,
        articles_per_month: articlesPerMonth,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        last_quota_reset_at: now.toISOString(),
      });

    if (insertError) {
      console.error("[GatewayWebhook] 建立訂閱失敗:", insertError);
      return;
    }

    console.log("[GatewayWebhook] 新訂閱已建立:", {
      planName,
      articles: articlesPerMonth,
    });
  }
}

/**
 * 處理終身方案購買
 */
async function handleLifetimePurchase(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  amount: number,
): Promise<void> {
  console.log("[GatewayWebhook] 處理終身方案購買:", { companyId, amount });

  // 這裡需要根據 AutoSEO 的實際終身方案邏輯來實作
  console.log("[GatewayWebhook] 終身方案邏輯待實作");
}

/**
 * 處理加購篇數
 *
 * 增加公司訂閱的加購文章額度。
 */
async function handleArticlePackagePurchase(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  packageId: string,
): Promise<void> {
  console.log("[GatewayWebhook] 處理加購篇數:", { companyId, packageId });

  // 查詢文章包
  const { data: pkg, error: pkgError } = await supabase
    .from("article_packages")
    .select("*")
    .eq("id", packageId)
    .single();

  if (pkgError || !pkg) {
    console.error("[GatewayWebhook] 找不到文章包:", packageId);
    return;
  }

  const articlesToAdd = pkg.articles as number;
  const packageName = pkg.name as string;

  // 查詢公司訂閱
  const { data: subscription } = await supabase
    .from("company_subscriptions")
    .select("*")
    .eq("company_id", companyId)
    .single();

  if (!subscription) {
    console.error("[GatewayWebhook] 找不到公司訂閱:", companyId);
    return;
  }

  // 更新加購篇數
  const currentPurchased =
    (subscription.purchased_articles_remaining as number) || 0;
  const newPurchased = currentPurchased + articlesToAdd;
  const purchaseCount = ((subscription.purchased_count as number) || 0) + 1;

  const { error: updateError } = await supabase
    .from("company_subscriptions")
    .update({
      purchased_articles_remaining: newPurchased,
      purchased_count: purchaseCount,
    })
    .eq("id", subscription.id);

  if (updateError) {
    console.error("[GatewayWebhook] 更新加購篇數失敗:", updateError);
    return;
  }

  console.log("[GatewayWebhook] 加購篇數已增加:", {
    packageName,
    articlesAdded: articlesToAdd,
    previousTotal: currentPurchased,
    newTotal: newPurchased,
  });
}

/**
 * 異步建立佣金記錄
 */
async function createCommissionAsync(
  orderData: Record<string, unknown>,
  event: WebhookEvent,
): Promise<void> {
  // TODO: 實作佣金記錄邏輯
  console.log("[GatewayWebhook] 佣金記錄待實作");
}

/**
 * 異步同步到 CRM
 */
async function syncToCrmAsync(companyId: string): Promise<void> {
  // TODO: 實作 CRM 同步邏輯
  console.log("[GatewayWebhook] CRM 同步待實作");
}
