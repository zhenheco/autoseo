/**
 * 多語系翻譯功能 - 存取控制
 *
 * 目前僅開放特定帳號使用翻譯功能
 */

/**
 * 允許使用翻譯功能的帳號 Email 清單
 */
const TRANSLATION_ALLOWED_EMAILS = ["acejou27@gmail.com"];

/**
 * 檢查使用者是否有權限使用翻譯功能
 *
 * @param email - 使用者 email
 * @returns 是否有權限
 */
export function canAccessTranslation(
  email: string | null | undefined,
): boolean {
  if (!email) {
    return false;
  }

  return TRANSLATION_ALLOWED_EMAILS.includes(email.toLowerCase());
}

/**
 * 檢查使用者是否有權限使用翻譯功能（拋出錯誤版本）
 *
 * @param email - 使用者 email
 * @throws Error 如果沒有權限
 */
export function requireTranslationAccess(
  email: string | null | undefined,
): void {
  if (!canAccessTranslation(email)) {
    throw new Error(
      "Translation feature is currently in beta. Access is restricted.",
    );
  }
}

/**
 * 取得允許的帳號清單（僅供管理用途）
 */
export function getTranslationAllowedEmails(): readonly string[] {
  return TRANSLATION_ALLOWED_EMAILS;
}
