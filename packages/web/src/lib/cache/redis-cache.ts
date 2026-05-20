/**
 * KV 快取工具（使用 Cloudflare KV）
 * 用於文章列表和內容的分散式快取
 *
 * 使用 CF Workers KV binding，適合 serverless 環境：
 * - 全球邊緣位置，低延遲
 * - 無連線管理問題
 * - Eventually consistent，適合快取場景
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

// ============================================
// 統計資料收集
// ============================================

/** 快取操作統計 */
interface CacheOperationStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  timeoutErrors: number;
  connectionErrors: number;
  totalLatency: number;
  lastError: string | null;
  lastErrorTime: Date | null;
  operationBreakdown: Record<
    string,
    { count: number; failures: number; totalLatency: number }
  >;
}

/** 初始化統計資料 */
const stats: CacheOperationStats = {
  totalOperations: 0,
  successfulOperations: 0,
  failedOperations: 0,
  timeoutErrors: 0,
  connectionErrors: 0,
  totalLatency: 0,
  lastError: null,
  lastErrorTime: null,
  operationBreakdown: {},
};

/**
 * 更新操作統計
 */
function updateStats(
  operationName: string,
  latency: number,
  success: boolean,
  errorType?: "timeout" | "connection" | "other",
): void {
  stats.totalOperations++;
  stats.totalLatency += latency;

  if (success) {
    stats.successfulOperations++;
  } else {
    stats.failedOperations++;
    if (errorType === "timeout") {
      stats.timeoutErrors++;
    } else if (errorType === "connection") {
      stats.connectionErrors++;
    }
  }

  // 記錄操作分類統計
  if (!stats.operationBreakdown[operationName]) {
    stats.operationBreakdown[operationName] = {
      count: 0,
      failures: 0,
      totalLatency: 0,
    };
  }
  stats.operationBreakdown[operationName].count++;
  stats.operationBreakdown[operationName].totalLatency += latency;
  if (!success) {
    stats.operationBreakdown[operationName].failures++;
  }
}

/**
 * 取得快取操作統計
 */
export function getRedisStats(): {
  totalOperations: number;
  successRate: number;
  avgLatency: number;
  timeoutRate: number;
  connectionErrorRate: number;
  lastError: string | null;
  lastErrorTime: string | null;
  operationBreakdown: Record<
    string,
    { count: number; failureRate: number; avgLatency: number }
  >;
} {
  const successRate =
    stats.totalOperations > 0
      ? stats.successfulOperations / stats.totalOperations
      : 1;
  const avgLatency =
    stats.totalOperations > 0 ? stats.totalLatency / stats.totalOperations : 0;
  const timeoutRate =
    stats.totalOperations > 0 ? stats.timeoutErrors / stats.totalOperations : 0;
  const connectionErrorRate =
    stats.totalOperations > 0
      ? stats.connectionErrors / stats.totalOperations
      : 0;

  const operationBreakdown: Record<
    string,
    { count: number; failureRate: number; avgLatency: number }
  > = {};
  for (const [name, data] of Object.entries(stats.operationBreakdown)) {
    operationBreakdown[name] = {
      count: data.count,
      failureRate: data.count > 0 ? data.failures / data.count : 0,
      avgLatency: data.count > 0 ? data.totalLatency / data.count : 0,
    };
  }

  return {
    totalOperations: stats.totalOperations,
    successRate: Math.round(successRate * 100) / 100,
    avgLatency: Math.round(avgLatency),
    timeoutRate: Math.round(timeoutRate * 100) / 100,
    connectionErrorRate: Math.round(connectionErrorRate * 100) / 100,
    lastError: stats.lastError,
    lastErrorTime: stats.lastErrorTime?.toISOString() || null,
    operationBreakdown,
  };
}

/** 快取配置 */
export const CACHE_CONFIG = {
  /** 文章列表快取 - 30 秒（頻繁變動） */
  ARTICLE_LIST: { prefix: "cache:articles:list", ttl: 30 },
  /** 文章 HTML 內容快取 - 5 分鐘（較少變動） */
  ARTICLE_HTML: { prefix: "cache:articles:html", ttl: 300 },
  /** 文章元資料快取 - 2 分鐘 */
  ARTICLE_META: { prefix: "cache:articles:meta", ttl: 120 },
  /** 網站文章統計 - 1 分鐘 */
  WEBSITE_STATS: { prefix: "cache:website:stats", ttl: 60 },
  /** 待處理文章任務 flag - 5 分鐘（Cron Job 優化用） */
  PENDING_ARTICLE_JOBS: { prefix: "jobs:pending:article", ttl: 300 },
  /** 待處理翻譯任務 flag - 5 分鐘（Cron Job 優化用） */
  PENDING_TRANSLATION_JOBS: { prefix: "jobs:pending:translation", ttl: 300 },
  /** 文章完整內容快取 - 10 分鐘（供翻譯使用） */
  ARTICLE_FULL_CONTENT: { prefix: "cache:article:full", ttl: 600 },
} as const;

/**
 * 取得 Cloudflare KV binding
 * 透過 opennextjs-cloudflare 的 getCloudflareContext 取得
 */
function getKV(): KVNamespace | null {
  try {
    const { env } = getCloudflareContext();
    const kv = (env as Record<string, unknown>).CACHE_KV as
      | KVNamespace
      | undefined;
    return kv || null;
  } catch {
    // 在非 CF 環境（如本地開發、測試）中，getCloudflareContext 會拋錯
    return null;
  }
}

/**
 * 安全執行 KV 命令
 *
 * @param operation - KV 操作函數
 * @param fallback - 失敗時的回傳值
 * @param operationName - 操作名稱（用於日誌和統計）
 */
async function safeExecute<T>(
  operation: (kv: KVNamespace) => Promise<T>,
  fallback: T,
  operationName: string = "unknown",
): Promise<T> {
  const startTime = Date.now();
  const kv = getKV();

  if (!kv) {
    updateStats(operationName, 0, false, "connection");
    return fallback;
  }

  try {
    const result = await operation(kv);
    const latency = Date.now() - startTime;
    updateStats(operationName, latency, true);

    // 如果延遲超過 500ms，記錄警告
    if (latency > 500) {
      console.warn(`[KVCache] ${operationName} slow: ${latency}ms`);
    }

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    stats.lastError = `${operationName}: ${errorMessage}`;
    stats.lastErrorTime = new Date();
    updateStats(operationName, latency, false, "other");
    console.error(
      `[KVCache] ${operationName} error after ${latency}ms:`,
      errorMessage,
    );
    return fallback;
  }
}

/**
 * 檢查快取是否可用（KV binding 是否存在）
 */
export function isRedisAvailable(): boolean {
  return getKV() !== null;
}

/**
 * 從快取獲取資料
 * @param key 快取 key
 * @returns 快取的資料，如果不存在則返回 null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  return safeExecute(
    async (kv) => {
      const data = await kv.get<T>(key, "json");
      return data;
    },
    null,
    "GET",
  );
}

/**
 * 設定快取資料
 * @param key 快取 key
 * @param value 要快取的資料
 * @param ttlSeconds TTL 秒數（KV 最低 60 秒，低於 60 秒會自動調整）
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<boolean> {
  return safeExecute(
    async (kv) => {
      // KV expirationTtl 最小值為 60 秒
      const effectiveTtl = Math.max(60, ttlSeconds);
      await kv.put(key, JSON.stringify(value), {
        expirationTtl: effectiveTtl,
      });
      return true;
    },
    false,
    "SET",
  );
}

/**
 * 刪除快取
 * @param key 快取 key（支援 prefix:* 萬用字元模式）
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const operationName = key.includes("*") ? "DEL_LIST" : "DEL";
  return safeExecute(
    async (kv) => {
      if (key.includes("*")) {
        // 使用 KV list() 取代 Redis SCAN
        const prefix = key.replace("*", "");
        const { keys } = await kv.list({ prefix });
        for (const k of keys) {
          await kv.delete(k.name);
        }
      } else {
        await kv.delete(key);
      }
      return true;
    },
    false,
    operationName,
  );
}

/**
 * 獲取或設定快取（Cache-Aside 模式）
 * @param key 快取 key
 * @param ttlSeconds TTL 秒數
 * @param fetcher 如果快取不存在，用於獲取資料的函數
 * @returns 快取或新獲取的資料
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<{ data: T; fromCache: boolean }> {
  // 嘗試從快取獲取
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // 快取未命中，執行 fetcher
  const data = await fetcher();

  // 非同步存入快取（不等待）
  cacheSet(key, data, ttlSeconds).catch(() => {});

  return { data, fromCache: false };
}

// ============================================
// 文章專用快取函數
// ============================================

/**
 * 生成文章列表快取 key
 * @param companyId 公司 ID
 * @param filter 篩選條件
 * @param websiteId 網站 ID（可選）
 */
export function articleListCacheKey(
  companyId: string,
  filter: string = "all",
  websiteId?: string,
): string {
  const base = `${CACHE_CONFIG.ARTICLE_LIST.prefix}:${companyId}:${filter}`;
  return websiteId ? `${base}:${websiteId}` : base;
}

/**
 * 生成文章 HTML 快取 key
 * @param articleId 文章 ID
 */
export function articleHtmlCacheKey(articleId: string): string {
  return `${CACHE_CONFIG.ARTICLE_HTML.prefix}:${articleId}`;
}

/**
 * 生成文章元資料快取 key
 * @param articleId 文章 ID
 */
export function articleMetaCacheKey(articleId: string): string {
  return `${CACHE_CONFIG.ARTICLE_META.prefix}:${articleId}`;
}

/**
 * 使公司的文章列表快取失效
 * @param companyId 公司 ID
 */
export async function invalidateArticleListCache(
  companyId: string,
): Promise<void> {
  await cacheDelete(`${CACHE_CONFIG.ARTICLE_LIST.prefix}:${companyId}:*`);
  console.log(
    `[KVCache] Invalidated article list cache for company: ${companyId}`,
  );
}

/**
 * 使單篇文章快取失效
 * @param articleId 文章 ID
 * @param companyId 公司 ID（用於同時失效列表快取）
 */
export async function invalidateArticleCache(
  articleId: string,
  companyId?: string,
): Promise<void> {
  await Promise.all([
    cacheDelete(articleHtmlCacheKey(articleId)),
    cacheDelete(articleMetaCacheKey(articleId)),
    companyId ? invalidateArticleListCache(companyId) : Promise.resolve(),
  ]);
  console.log(`[KVCache] Invalidated cache for article: ${articleId}`);
}

/** 快取統計資訊類型 */
interface CacheStats {
  connected: boolean;
  keyCount: number;
  memoryUsage: string;
}

/**
 * 快取統計資訊
 * KV 沒有 Redis INFO 等價命令，使用 list() 估算 key 數量
 */
export async function getCacheStats(): Promise<CacheStats> {
  return safeExecute<CacheStats>(
    async (kv) => {
      // KV list() 每次最多返回 1000 個 key，用來估算
      const { keys } = await kv.list({ limit: 1000 });

      return {
        connected: true,
        keyCount: keys.length,
        memoryUsage: "N/A (Cloudflare KV)",
      };
    },
    { connected: false, keyCount: 0, memoryUsage: "0" },
    "INFO",
  );
}
