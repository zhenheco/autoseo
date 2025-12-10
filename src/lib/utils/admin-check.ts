/**
 * Admin 權限檢查工具
 * 使用環境變數管理 admin emails，避免硬編碼在源碼中
 */

/**
 * 從環境變數獲取 admin email 列表
 * @returns admin email 陣列
 */
export function getAdminEmails(): string[] {
  const emails = process.env.ADMIN_EMAILS || "";
  return emails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * 檢查 email 是否為 admin
 * @param email 要檢查的 email
 * @returns 是否為 admin
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.toLowerCase());
}

/**
 * 驗證 admin 權限（用於 API routes）
 * @param userEmail 用戶 email
 * @returns 驗證結果
 */
export function validateAdminAccess(userEmail: string | null | undefined): {
  isAdmin: boolean;
  error?: string;
} {
  if (!userEmail) {
    return { isAdmin: false, error: "無法獲取用戶 email" };
  }

  if (!isAdminEmail(userEmail)) {
    return { isAdmin: false, error: "無管理員權限" };
  }

  return { isAdmin: true };
}
