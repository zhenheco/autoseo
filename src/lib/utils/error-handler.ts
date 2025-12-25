/**
 * 錯誤處理工具函數
 * 避免在生產環境洩漏敏感資訊
 */

import { ErrorNotificationService } from "@/lib/notifications/error-notification-service";

/**
 * 安全的錯誤訊息提取
 * 在生產環境中隱藏詳細錯誤訊息，只返回通用訊息
 */
export function getSafeErrorMessage(error: unknown): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  // 開發環境返回詳細錯誤
  if (isDevelopment) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  // 生產環境返回通用錯誤訊息
  return "操作失敗，請稍後再試";
}

/**
 * CRITICAL 錯誤關鍵字清單
 * 包含這些關鍵字的錯誤會被視為 CRITICAL 並發送通知
 */
const CRITICAL_ERROR_PATTERNS = [
  // 資料庫相關
  "connection refused",
  "connection reset",
  "database connection",
  "supabase",
  "postgres",
  // 認證相關
  "authentication failed",
  "unauthorized",
  "invalid token",
  "jwt expired",
  // 支付相關
  "payment failed",
  "billing error",
  "stripe error",
  // 系統相關
  "out of memory",
  "heap out of memory",
  "fatal error",
  "uncaught exception",
  "unhandled rejection",
];

/**
 * 判斷是否為 CRITICAL 錯誤
 */
function isCriticalError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return CRITICAL_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * 分類錯誤類型
 */
function categorizeError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (message.includes("timeout") || message.includes("etimedout")) {
    return "timeout";
  }
  if (
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("connection")
  ) {
    return "network";
  }
  if (message.includes("parse") || message.includes("json")) {
    return "parsing";
  }
  if (message.includes("validation") || message.includes("invalid")) {
    return "validation";
  }
  if (message.includes("api") || message.includes("model")) {
    return "ai_api";
  }
  if (message.includes("rate") || message.includes("limit")) {
    return "rate_limit";
  }

  return "unknown";
}

/**
 * 安全的錯誤日誌記錄
 * 在伺服器端記錄詳細錯誤，但不返回給客戶端
 * 如果是 CRITICAL 錯誤，會發送郵件通知給管理員
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);

  // 判斷是否為 CRITICAL 錯誤並發送通知
  if (isCriticalError(error)) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    ErrorNotificationService.getInstance()
      .notify({
        id: `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        category: categorizeError(error),
        severity: "critical",
        message: errorMessage,
        stack: errorStack,
        context: {
          source: "api",
          endpoint: context,
        },
        timestamp: new Date().toISOString(),
      })
      .catch((notifyError) => {
        console.error("[logError] 發送錯誤通知失敗:", notifyError);
      });
  }
}

/**
 * 建立安全的 API 錯誤回應
 */
export function createErrorResponse(
  error: unknown,
  context: string,
  status: number = 500,
): Response {
  logError(context, error);

  return Response.json(
    {
      error: getSafeErrorMessage(error),
      ...(process.env.NODE_ENV === "development" && {
        details: error instanceof Error ? error.stack : String(error),
      }),
    },
    { status },
  );
}

/**
 * 驗證和清理使用者輸入
 * 防止 SQL Injection、XSS 等攻擊
 */
export function sanitizeInput(input: string): string {
  // 移除潛在的危險字元
  return input
    .replace(/[<>]/g, "") // 移除 HTML 標籤
    .replace(/['"]/g, "") // 移除引號
    .trim();
}

/**
 * 驗證環境變數是否設定
 * 避免在錯誤訊息中洩漏環境變數名稱
 */
export function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    logError(
      "Environment Variable",
      `Required environment variable missing: ${key}`,
    );
    throw new Error("服務器配置錯誤");
  }

  return value;
}

/**
 * 安全的資料庫錯誤處理
 * 不洩漏資料庫結構和查詢資訊
 */
export function handleDatabaseError(error: unknown): string {
  logError("Database", error);

  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment && error instanceof Error) {
    return error.message;
  }

  // 生產環境返回通用訊息
  return "資料庫操作失敗";
}

/**
 * 安全的第三方 API 錯誤處理
 * 不洩漏 API 金鑰和端點資訊
 */
export function handleApiError(error: unknown, service: string): string {
  logError(`API:${service}`, error);

  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment && error instanceof Error) {
    return `${service} API Error: ${error.message}`;
  }

  // 生產環境返回通用訊息
  return `${service} 服務暫時無法使用`;
}
