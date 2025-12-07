/**
 * 帶自動重試功能的 fetch 工具函式
 * 用於處理 504 超時等暫時性錯誤
 */

interface RetryOptions {
  /** 最大重試次數（預設 2 次） */
  maxRetries?: number;
  /** 重試間隔毫秒數（預設 1500ms） */
  delayMs?: number;
  /** 重試時的回調函式 */
  onRetry?: (attempt: number, maxRetries: number) => void;
}

/**
 * 帶自動重試功能的 fetch
 *
 * @param url - 請求 URL
 * @param options - fetch 選項
 * @param retryOptions - 重試配置
 * @returns Response 對象
 * @throws 當所有重試都失敗時拋出錯誤
 *
 * @example
 * const response = await fetchWithRetry(
 *   "/api/articles/generate-batch",
 *   { method: "POST", body: JSON.stringify(data) },
 *   {
 *     maxRetries: 2,
 *     onRetry: (attempt, max) => console.log(`重試 ${attempt}/${max}`)
 *   }
 * );
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retryOptions: RetryOptions = {},
): Promise<Response> {
  const { maxRetries = 2, delayMs = 1500, onRetry } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // 成功或非 504 錯誤，直接返回
      if (response.ok || response.status !== 504) {
        return response;
      }

      // 504 超時，準備重試
      lastError = new Error("請求超時 (504)");

      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, maxRetries);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    } catch (error) {
      // 網路錯誤等
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        onRetry?.(attempt + 1, maxRetries);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  // 所有重試都失敗
  throw lastError || new Error("請求失敗");
}
