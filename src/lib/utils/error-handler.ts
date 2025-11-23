/**
 * 錯誤處理工具函數
 * 避免在生產環境洩漏敏感資訊
 */

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
 * 安全的錯誤日誌記錄
 * 在伺服器端記錄詳細錯誤，但不返回給客戶端
 */
export function logError(context: string, error: unknown): void {
  console.error(`[${context}]`, error);

  // TODO: 整合錯誤追蹤服務（如 Sentry）
  // if (process.env.ERROR_TRACKING_ENABLED === 'true') {
  //   Sentry.captureException(error, { tags: { context } })
  // }
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
