/**
 * 帶 timeout 的 fetch 工具
 * 防止連接洩漏，確保所有 HTTP 請求都有超時限制
 */

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number; // 超時時間（毫秒），預設 10000ms
}

/**
 * 帶 timeout 的 fetch
 * @param url 請求 URL
 * @param options fetch 選項，包含 timeout
 * @returns Promise<Response>
 * @throws Error 當超時或請求失敗時
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 帶 timeout 的 fetch，返回 JSON
 * @param url 請求 URL
 * @param options fetch 選項
 * @returns Promise<T> 解析後的 JSON
 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<T> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 帶 timeout 的 fetch，返回文字
 * @param url 請求 URL
 * @param options fetch 選項
 * @returns Promise<string> 回應文字
 */
export async function fetchTextWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {},
): Promise<string> {
  const response = await fetchWithTimeout(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.text();
}

/**
 * 檢查 URL 是否可存取（HEAD 請求）
 * @param url 要檢查的 URL
 * @param timeout 超時時間（毫秒）
 * @returns Promise<boolean> URL 是否可存取
 */
export async function checkUrlExists(
  url: string,
  timeout = 5000,
): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(url, {
      method: "HEAD",
      timeout,
    });
    return response.ok;
  } catch {
    return false;
  }
}
