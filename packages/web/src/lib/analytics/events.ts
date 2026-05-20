/**
 * Google Analytics 4 事件追蹤 Helper Functions
 *
 * 使用方式：
 * import { trackEvent, trackArticleGeneration } from "@/lib/analytics/events";
 *
 * trackEvent("button_click", { button_name: "submit" });
 * trackArticleGeneration("article-123", ["SEO", "行銷"]);
 */

// ================================================
// 類型定義
// ================================================

/** GA4 事件參數類型 */
export interface GA4EventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  currency?: string;
  [key: string]: unknown;
}

/** 購買事件參數 */
export interface PurchaseEventParams {
  transaction_id: string;
  value: number;
  currency?: string;
  items?: Array<{
    item_id: string;
    item_name: string;
    price: number;
    quantity?: number;
  }>;
}

// ================================================
// 基礎追蹤函數
// ================================================

/**
 * 檢查 gtag 是否可用
 */
function isGtagAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

/**
 * 通用事件追蹤
 * @param eventName 事件名稱
 * @param parameters 事件參數
 */
export function trackEvent(
  eventName: string,
  parameters?: GA4EventParams,
): void {
  if (!isGtagAvailable()) {
    // 開發環境記錄未追蹤的事件
    if (process.env.NODE_ENV === "development") {
      console.log("[GA4 Event - Not Tracked]", eventName, parameters);
    }
    return;
  }

  window.gtag("event", eventName, parameters);

  // 開發環境記錄
  if (process.env.NODE_ENV === "development") {
    console.log("[GA4 Event]", eventName, parameters);
  }
}

/**
 * 設定用戶屬性
 * @param properties 用戶屬性
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (!isGtagAvailable()) return;
  window.gtag("set", "user_properties", properties);
}

/**
 * 設定用戶 ID
 * @param userId 用戶 ID
 */
export function setUserId(userId: string): void {
  if (!isGtagAvailable()) return;
  window.gtag("config", process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
    user_id: userId,
  });
}

// ================================================
// 預定義事件追蹤
// ================================================

/**
 * 追蹤文章生成事件
 * @param articleId 文章 ID
 * @param keywords 關鍵字列表
 * @param wordCount 字數（可選）
 */
export function trackArticleGeneration(
  articleId: string,
  keywords: string[],
  wordCount?: number,
): void {
  trackEvent("article_generation", {
    article_id: articleId,
    keywords: keywords.join(","),
    keyword_count: keywords.length,
    word_count: wordCount,
    event_category: "engagement",
  });
}

/**
 * 追蹤文章發布事件
 * @param articleId 文章 ID
 * @param platform 發布平台（wordpress, medium 等）
 */
export function trackArticlePublish(articleId: string, platform: string): void {
  trackEvent("article_publish", {
    article_id: articleId,
    platform,
    event_category: "engagement",
  });
}

/**
 * 追蹤訂閱事件
 * @param planName 方案名稱
 * @param amount 金額
 * @param billingCycle 計費週期（monthly, yearly）
 */
export function trackSubscription(
  planName: string,
  amount: number,
  billingCycle: "monthly" | "yearly",
): void {
  trackEvent("subscription", {
    plan_name: planName,
    value: amount,
    currency: "TWD",
    billing_cycle: billingCycle,
    event_category: "conversion",
  });
}

/**
 * 追蹤購買事件（付款完成）
 * @param params 購買參數
 */
export function trackPurchase(params: PurchaseEventParams): void {
  trackEvent("purchase", {
    transaction_id: params.transaction_id,
    value: params.value,
    currency: params.currency || "TWD",
    items: params.items,
    event_category: "conversion",
  });
}

/**
 * 追蹤 Token 購買事件
 * @param packageName 套餐名稱
 * @param tokenAmount Token 數量
 * @param price 價格
 */
export function trackTokenPurchase(
  packageName: string,
  tokenAmount: number,
  price: number,
): void {
  trackEvent("token_purchase", {
    package_name: packageName,
    token_amount: tokenAmount,
    value: price,
    currency: "TWD",
    event_category: "conversion",
  });
}

/**
 * 追蹤註冊事件
 * @param method 註冊方式（email, google, github 等）
 */
export function trackSignUp(method: string): void {
  trackEvent("sign_up", {
    method,
    event_category: "engagement",
  });
}

/**
 * 追蹤登入事件
 * @param method 登入方式
 */
export function trackLogin(method: string): void {
  trackEvent("login", {
    method,
    event_category: "engagement",
  });
}

/**
 * 追蹤搜尋事件
 * @param searchTerm 搜尋關鍵字
 */
export function trackSearch(searchTerm: string): void {
  trackEvent("search", {
    search_term: searchTerm,
    event_category: "engagement",
  });
}

/**
 * 追蹤錯誤事件
 * @param errorType 錯誤類型
 * @param errorMessage 錯誤訊息
 * @param location 發生位置
 */
export function trackError(
  errorType: string,
  errorMessage: string,
  location?: string,
): void {
  trackEvent("error", {
    error_type: errorType,
    error_message: errorMessage,
    error_location: location,
    event_category: "error",
  });
}

/**
 * 追蹤功能使用事件
 * @param featureName 功能名稱
 * @param action 操作（click, view, enable, disable 等）
 */
export function trackFeatureUsage(featureName: string, action: string): void {
  trackEvent("feature_usage", {
    feature_name: featureName,
    action,
    event_category: "engagement",
  });
}

/**
 * 追蹤網站連接事件（GSC/GA4 OAuth）
 * @param serviceType 服務類型（gsc, ga4）
 * @param success 是否成功
 */
export function trackGoogleConnect(
  serviceType: "gsc" | "ga4",
  success: boolean,
): void {
  trackEvent("google_connect", {
    service_type: serviceType,
    success,
    event_category: "engagement",
  });
}

/**
 * 追蹤推薦計劃事件
 * @param action 操作（share, click, register, payment）
 * @param referralCode 推薦碼
 */
export function trackReferral(
  action: "share" | "click" | "register" | "payment",
  referralCode: string,
): void {
  trackEvent("referral", {
    action,
    referral_code: referralCode,
    event_category: "engagement",
  });
}

// ================================================
// 電商相關事件（Enhanced Ecommerce）
// ================================================

/**
 * 追蹤查看商品事件
 * @param itemId 商品 ID
 * @param itemName 商品名稱
 * @param price 價格
 */
export function trackViewItem(
  itemId: string,
  itemName: string,
  price: number,
): void {
  trackEvent("view_item", {
    currency: "TWD",
    value: price,
    items: [
      {
        item_id: itemId,
        item_name: itemName,
        price,
        quantity: 1,
      },
    ],
  });
}

/**
 * 追蹤開始結帳事件
 * @param items 商品列表
 * @param totalValue 總金額
 */
export function trackBeginCheckout(
  items: Array<{ item_id: string; item_name: string; price: number }>,
  totalValue: number,
): void {
  trackEvent("begin_checkout", {
    currency: "TWD",
    value: totalValue,
    items: items.map((item) => ({
      ...item,
      quantity: 1,
    })),
  });
}
