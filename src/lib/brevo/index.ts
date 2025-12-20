/**
 * Brevo 整合模組
 * 用於用戶分群和自動化 Email 跟進系統
 *
 * 主要功能：
 * - 同步用戶資料到 Brevo Contacts
 * - 根據用戶行為自動分群
 * - 觸發 Brevo 自動化 Email 序列
 *
 * 使用方式：
 * ```typescript
 * import { syncUserToBrevo, syncCompanyOwnerToBrevo } from '@/lib/brevo';
 *
 * // 註冊後同步
 * await syncUserToBrevo(userId);
 *
 * // 訂閱變更後同步
 * await syncCompanyOwnerToBrevo(companyId);
 * ```
 */

// 類型導出
export type {
  UserSegment,
  BrevoContactAttributes,
  UserDataForBrevo,
  SyncResult,
  UserSyncResult,
} from "./types";

export { BREVO_LISTS } from "./types";

// 客戶端
export { isBrevoConfigured } from "./client";

// 分群邏輯
export {
  calculateSegment,
  getListIdBySegment,
  getSegmentDisplayName,
} from "./segments";

// 同步功能
export {
  syncUserToBrevo,
  syncAllUsersToBrevo,
  syncCompanyOwnerToBrevo,
} from "./sync";

// Contact 操作
export { upsertContact, deleteContact, getContact } from "./contacts";
