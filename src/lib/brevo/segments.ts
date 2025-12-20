/**
 * 用戶分群邏輯
 * 根據用戶行為和狀態計算所屬分群，用於觸發不同的 Email 自動化序列
 */

import { UserSegment, BrevoContactAttributes, BREVO_LISTS } from "./types";

/**
 * 計算天數差
 */
function daysBetween(dateStr: string, now: Date): number {
  const date = new Date(dateStr);
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 根據用戶數據計算所屬分群
 *
 * 優先順序（從上到下判斷）：
 * 1. PAID_USERS:              subscription_tier !== 'free'
 * 2. QUOTA_EXHAUSTED:         quota_remaining === 0
 * 3. DORMANT:                 last_sign_in_at > 7 天前
 * 4. NEW_NO_ACTION:           created_at ≤ 7 天前 && articles_generated === 0
 * 5. GENERATED_NOT_PUBLISHED: articles_generated > 0 && articles_published === 0
 * 6. READY_TO_UPGRADE:        quota_used_percent >= 50
 * 7. ACTIVE_FREE:             其他免費用戶
 */
export function calculateSegment(
  attrs: Omit<BrevoContactAttributes, "SEGMENT">,
): UserSegment {
  const now = new Date();
  const daysSinceRegistration = daysBetween(attrs.REGISTERED_AT, now);
  const daysSinceLastLogin = daysBetween(attrs.LAST_LOGIN_AT, now);

  // 1. 付費用戶優先判斷
  if (attrs.PLAN !== "free") {
    return "PAID_USERS";
  }

  // 2. 額度耗盡（免費用戶）
  if (attrs.QUOTA_REMAINING === 0) {
    return "QUOTA_EXHAUSTED";
  }

  // 3. 沉睡用戶（7 天未登入的免費用戶）
  if (daysSinceLastLogin >= 7) {
    return "DORMANT";
  }

  // 4. 新用戶未行動（註冊 7 天內且沒生成文章）
  if (daysSinceRegistration <= 7 && attrs.ARTICLES_GENERATED === 0) {
    return "NEW_NO_ACTION";
  }

  // 5. 生成但未發布
  if (attrs.ARTICLES_GENERATED > 0 && attrs.ARTICLES_PUBLISHED === 0) {
    return "GENERATED_NOT_PUBLISHED";
  }

  // 6. 待升級（額度用 50% 以上）
  if (attrs.QUOTA_USED_PERCENT >= 50) {
    return "READY_TO_UPGRADE";
  }

  // 7. 活躍免費用戶（預設）
  return "ACTIVE_FREE";
}

/**
 * 根據分群取得對應的 Brevo List ID
 */
export function getListIdBySegment(segment: UserSegment): number {
  const mapping: Record<UserSegment, number> = {
    NEW_NO_ACTION: BREVO_LISTS.NEW_NO_ACTION,
    GENERATED_NOT_PUBLISHED: BREVO_LISTS.GENERATED_NOT_PUBLISHED,
    ACTIVE_FREE: BREVO_LISTS.ACTIVE_FREE,
    READY_TO_UPGRADE: BREVO_LISTS.READY_TO_UPGRADE,
    QUOTA_EXHAUSTED: BREVO_LISTS.QUOTA_EXHAUSTED,
    DORMANT: BREVO_LISTS.DORMANT,
    PAID_USERS: BREVO_LISTS.PAID_USERS,
  };
  return mapping[segment];
}

/**
 * 取得所有分群的 List IDs（用於從舊分群移除）
 */
export function getAllSegmentListIds(): number[] {
  return [
    BREVO_LISTS.NEW_NO_ACTION,
    BREVO_LISTS.GENERATED_NOT_PUBLISHED,
    BREVO_LISTS.ACTIVE_FREE,
    BREVO_LISTS.READY_TO_UPGRADE,
    BREVO_LISTS.QUOTA_EXHAUSTED,
    BREVO_LISTS.DORMANT,
    BREVO_LISTS.PAID_USERS,
  ];
}

/**
 * 取得分群的中文名稱（用於日誌）
 */
export function getSegmentDisplayName(segment: UserSegment): string {
  const names: Record<UserSegment, string> = {
    NEW_NO_ACTION: "新用戶未行動",
    GENERATED_NOT_PUBLISHED: "生成未發布",
    ACTIVE_FREE: "活躍免費用戶",
    READY_TO_UPGRADE: "待升級用戶",
    QUOTA_EXHAUSTED: "額度耗盡",
    DORMANT: "沉睡用戶",
    PAID_USERS: "付費用戶",
  };
  return names[segment];
}
