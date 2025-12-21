/**
 * Affiliate System API Client
 *
 * 封裝與新 Affiliate System (affiliate.1wayseo.com) 的 API 通訊
 * 參考文件：affiliate-system/docs/product-integration-guide.md
 */

const AFFILIATE_URL = process.env.AFFILIATE_SYSTEM_URL;
const WEBHOOK_SECRET = process.env.AFFILIATE_WEBHOOK_SECRET;
const PRODUCT_CODE = process.env.AFFILIATE_PRODUCT_CODE;

// ==================== Types ====================

interface RegistrationParams {
  /** 推薦碼（8 位大寫英數字） */
  referralCode: string;
  /** 被推薦用戶的 UUID */
  referredUserId: string;
  /** 被推薦用戶的 Email */
  referredUserEmail?: string;
  /** 來源頁面 URL */
  sourceUrl?: string;
  /** UTM 來源 */
  utmSource?: string;
  /** UTM 媒介 */
  utmMedium?: string;
  /** UTM 活動 */
  utmCampaign?: string;
}

interface CommissionParams {
  /** 付款用戶的 UUID */
  referredUserId: string;
  /** 產品端的訂單 ID */
  externalOrderId: string;
  /** 訂單金額（正整數） */
  orderAmount: number;
  /** 訂單類型 */
  orderType: "subscription" | "addon" | "renewal" | "upgrade" | "one_time";
  /** 貨幣代碼，預設 TWD */
  currency?: string;
}

interface RegistrationResult {
  success: boolean;
  referralId: string;
}

interface CommissionResult {
  success: boolean;
  commissionId: string;
  baseRate: number;
  tierBonus: number;
  effectiveRate: number;
  commissionAmount: number;
  unlockAt: string;
}

// ==================== Helper ====================

/**
 * 檢查 Affiliate System 是否已設定
 */
function isConfigured(): boolean {
  return !!(AFFILIATE_URL && WEBHOOK_SECRET && PRODUCT_CODE);
}

// ==================== API Functions ====================

/**
 * 追蹤推薦註冊
 *
 * 當用戶透過推薦連結註冊時呼叫此函數
 * 會在新專案建立推薦關係
 *
 * @param params 註冊參數
 * @returns 成功時返回 referralId，失敗時返回 null
 */
export async function trackRegistration(
  params: RegistrationParams,
): Promise<RegistrationResult | null> {
  if (!isConfigured()) {
    console.warn("[AffiliateClient] 系統未設定，跳過推薦追蹤");
    return null;
  }

  try {
    const response = await fetch(`${AFFILIATE_URL}/api/tracking/registration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET!,
      },
      body: JSON.stringify({
        productCode: PRODUCT_CODE,
        ...params,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // 409 = 已存在推薦關係，這是正常情況
      if (response.status === 409) {
        console.log("[AffiliateClient] 推薦關係已存在，跳過");
        return null;
      }
      console.error("[AffiliateClient] 註冊追蹤失敗:", error);
      return null;
    }

    const result = await response.json();
    console.log("[AffiliateClient] 註冊追蹤成功:", result.referralId);
    return result;
  } catch (error) {
    console.error("[AffiliateClient] 註冊追蹤錯誤:", error);
    return null;
  }
}

/**
 * 建立佣金記錄
 *
 * 當付款成功時呼叫此函數
 * 會在新專案建立佣金記錄（如果用戶有推薦關係）
 *
 * @param params 佣金參數
 * @returns 成功時返回佣金資訊，失敗或無推薦關係時返回 null
 */
export async function createCommission(
  params: CommissionParams,
): Promise<CommissionResult | null> {
  if (!isConfigured()) {
    console.warn("[AffiliateClient] 系統未設定，跳過佣金記錄");
    return null;
  }

  try {
    const response = await fetch(`${AFFILIATE_URL}/api/commissions/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": WEBHOOK_SECRET!,
      },
      body: JSON.stringify({
        productCode: PRODUCT_CODE,
        currency: "TWD",
        ...params,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // 找不到推薦關係是正常情況（非推薦用戶）
      if (
        response.status === 400 &&
        (error.error === "找不到推薦關係" || error.message === "找不到推薦關係")
      ) {
        // 靜默處理，不記錄錯誤
        return null;
      }
      // 409 = 重複訂單，也是正常情況
      if (response.status === 409) {
        console.log("[AffiliateClient] 訂單已存在，跳過");
        return null;
      }
      console.error("[AffiliateClient] 佣金記錄失敗:", error);
      return null;
    }

    const result = await response.json();
    console.log(
      `[AffiliateClient] 佣金記錄成功: ${result.commissionAmount} 元`,
    );
    return result;
  } catch (error) {
    console.error("[AffiliateClient] 佣金記錄錯誤:", error);
    return null;
  }
}
