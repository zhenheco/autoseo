/**
 * Brevo 整合類型定義
 * 用於用戶分群和自動化 Email 跟進系統
 */

/**
 * 用戶分群類型
 * 根據用戶行為和狀態進行分群，用於觸發不同的 Email 自動化序列
 */
export type UserSegment =
  | "NEW_NO_ACTION" // 新用戶未行動：註冊 ≤7 天且生成文章數 = 0
  | "GENERATED_NOT_PUBLISHED" // 生成未發布：生成文章數 > 0 且發布數 = 0
  | "ACTIVE_FREE" // 活躍免費用戶：有發布且額度 < 50%
  | "READY_TO_UPGRADE" // 待升級用戶：額度 ≥ 50% 且 plan = free
  | "QUOTA_EXHAUSTED" // 額度耗盡：額度 = 0 且 plan = free
  | "DORMANT" // 沉睡用戶：最後登入 > 7 天且 plan = free
  | "PAID_USERS"; // 付費用戶：plan !== free

/**
 * Brevo Contact 屬性
 * 對應 Brevo Dashboard 中建立的 Contact Attributes
 */
export interface BrevoContactAttributes {
  /** Supabase auth.users ID */
  USER_ID: string;
  /** 用戶名稱（email 前綴或顯示名稱） */
  FIRSTNAME: string;
  /** 公司 ID */
  COMPANY_ID: string;
  /** 公司名稱 */
  COMPANY_NAME: string;
  /** 註冊時間（ISO 日期字串） */
  REGISTERED_AT: string;
  /** 訂閱方案：free/starter/pro/business/agency */
  PLAN: "free" | "starter" | "pro" | "business" | "agency";
  /** 已生成文章數（article_jobs status=completed） */
  ARTICLES_GENERATED: number;
  /** 已發布文章數（generated_articles status=published） */
  ARTICLES_PUBLISHED: number;
  /** 是否連接 WordPress */
  WP_CONNECTED: boolean;
  /** 剩餘額度（篇數） */
  QUOTA_REMAINING: number;
  /** 額度使用百分比 (0-100) */
  QUOTA_USED_PERCENT: number;
  /** 最後登入時間（ISO 日期字串） */
  LAST_LOGIN_AT: string;
  /** 最後生成文章時間（ISO 日期字串，可為 null） */
  LAST_ARTICLE_AT: string | null;
  /** 當前分群代號 */
  SEGMENT: UserSegment;
}

/**
 * 用於同步到 Brevo 的用戶資料
 */
export interface UserDataForBrevo {
  /** 用戶 Email */
  email: string;
  /** Contact 屬性 */
  attributes: BrevoContactAttributes;
}

/**
 * Brevo List IDs
 * 已透過 API 建立，對應 Brevo Dashboard 中的 Lists
 */
export const BREVO_LISTS = {
  /** 所有用戶（autoseo-all-users） */
  ALL_USERS: 9,
  /** 新用戶未行動（autoseo-new-no-action） */
  NEW_NO_ACTION: 3,
  /** 生成未發布（autoseo-generated-not-published） */
  GENERATED_NOT_PUBLISHED: 4,
  /** 活躍免費用戶（autoseo-active-free） */
  ACTIVE_FREE: 5,
  /** 待升級用戶（autoseo-ready-to-upgrade） */
  READY_TO_UPGRADE: 6,
  /** 額度耗盡（autoseo-quota-exhausted） */
  QUOTA_EXHAUSTED: 10,
  /** 沉睡用戶（autoseo-dormant） */
  DORMANT: 7,
  /** 付費用戶（autoseo-paid-users） */
  PAID_USERS: 8,
} as const;

/**
 * 同步結果
 */
export interface SyncResult {
  /** 成功同步的用戶數 */
  synced: number;
  /** 發生錯誤的用戶數 */
  errors: number;
  /** 跳過的用戶數（例如沒有 email） */
  skipped: number;
}

/**
 * 單一用戶同步結果
 */
export interface UserSyncResult {
  success: boolean;
  userId: string;
  email?: string;
  segment?: UserSegment;
  error?: string;
}
