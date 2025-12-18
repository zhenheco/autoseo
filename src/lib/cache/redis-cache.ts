/**
 * Redis 快取工具
 * 用於文章列表和內容的分散式快取
 *
 * 針對 Vercel serverless 環境優化：
 * - 連線狀態檢查和自動重連
 * - 優雅降級（Redis 不可用時 fallback 到資料庫）
 */

import Redis from "ioredis";

// ============================================
// 統計資料收集
// ============================================

/** Redis 操作統計 */
interface RedisStats {
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
const stats: RedisStats = {
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
 * 取得 Redis 操作統計
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

/** Redis 客戶端單例 */
let redisClient: Redis | null = null;
/** 最後一次連線錯誤時間 */
let lastConnectionError: number = 0;
/** 連線錯誤後的冷卻時間（毫秒） */
const CONNECTION_COOLDOWN = 5000;

/**
 * 建立新的 Redis 客戶端
 * 不使用 lazyConnect，讓 ioredis 自動管理連接
 */
function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 3) {
        lastConnectionError = Date.now();
        return null; // 停止重試
      }
      return Math.min(times * 200, 2000);
    },
    enableOfflineQueue: false, // serverless 環境不使用離線佇列
    connectTimeout: 5000,
    commandTimeout: 3000,
    // 不使用 lazyConnect，讓 ioredis 自動連接
  });

  client.on("error", (err) => {
    // 只有真正的連接錯誤才觸發冷卻（排除 Stream isn't writeable）
    const isStreamError = err.message.includes("Stream isn't writeable");
    if (!isStreamError) {
      console.error("[RedisCache] Connection error:", err.message);
      // 只在嚴重錯誤時觸發冷卻
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ETIMEDOUT") ||
        err.message.includes("ENOTFOUND")
      ) {
        lastConnectionError = Date.now();
      }
    }
  });

  client.on("close", () => {
    // 連線關閉時清理客戶端，下次會重新建立
    if (redisClient === client) {
      redisClient = null;
    }
  });

  client.on("ready", () => {
    // 連接成功，重置錯誤計時
    lastConnectionError = 0;
  });

  return client;
}

/**
 * 強制重新建立連線
 */
function reconnect(): Redis | null {
  if (redisClient) {
    try {
      redisClient.disconnect();
    } catch {
      // 忽略斷開連線時的錯誤
    }
    redisClient = null;
  }
  return getRedis();
}

/**
 * 取得 Redis 客戶端
 * 在 serverless 環境中優化連線處理
 */
function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  // 冷卻機制：如果最近有嚴重連線錯誤，暫時跳過 Redis
  if (
    lastConnectionError &&
    Date.now() - lastConnectionError < CONNECTION_COOLDOWN
  ) {
    return null;
  }

  // 檢查現有連線狀態
  if (redisClient) {
    const status = redisClient.status;
    // 如果連線已斷開或錯誤狀態，清理並重建
    if (status === "end" || status === "close") {
      redisClient = null;
    }
  }

  if (!redisClient) {
    redisClient = createRedisClient();
  }

  return redisClient;
}

/**
 * 等待 Redis 連接就緒
 */
async function waitForReady(
  redis: Redis,
  timeoutMs: number = 3000,
): Promise<boolean> {
  if (redis.status === "ready") return true;
  if (redis.status === "end" || redis.status === "close") return false;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, timeoutMs);

    const onReady = () => {
      clearTimeout(timeout);
      redis.removeListener("error", onError);
      resolve(true);
    };

    const onError = () => {
      clearTimeout(timeout);
      redis.removeListener("ready", onReady);
      resolve(false);
    };

    redis.once("ready", onReady);
    redis.once("error", onError);
  });
}

/**
 * 安全執行 Redis 命令
 * 失敗時自動重試一次，最終失敗則返回 fallback 值
 *
 * @param operation - Redis 操作函數
 * @param fallback - 失敗時的回傳值
 * @param operationName - 操作名稱（用於日誌和統計）
 */
async function safeExecute<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T,
  operationName: string = "unknown",
): Promise<T> {
  const startTime = Date.now();
  let redis = getRedis();

  if (!redis) {
    updateStats(operationName, 0, false, "connection");
    return fallback;
  }

  try {
    // 等待連接就緒（如果正在連接中）
    if (redis.status !== "ready") {
      const isReady = await waitForReady(redis);
      if (!isReady) {
        // 連接失敗，嘗試重建
        redis = reconnect();
        if (!redis) {
          const latency = Date.now() - startTime;
          updateStats(operationName, latency, false, "connection");
          console.error(
            `[RedisCache] ${operationName} failed: connection not ready (${latency}ms)`,
          );
          return fallback;
        }
        const retryReady = await waitForReady(redis);
        if (!retryReady) {
          lastConnectionError = Date.now();
          const latency = Date.now() - startTime;
          updateStats(operationName, latency, false, "connection");
          console.error(
            `[RedisCache] ${operationName} failed: reconnection failed (${latency}ms)`,
          );
          return fallback;
        }
      }
    }

    const result = await operation(redis);
    const latency = Date.now() - startTime;
    updateStats(operationName, latency, true);

    // 如果延遲超過 1 秒，記錄警告
    if (latency > 1000) {
      console.warn(`[RedisCache] ${operationName} slow: ${latency}ms`);
    }

    return result;
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // 判斷錯誤類型
    const isTimeoutError = errorMessage.includes("timed out");
    const isConnectionError =
      errorMessage.includes("Stream isn't writeable") ||
      errorMessage.includes("Connection is closed") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT");

    if (isTimeoutError) {
      stats.lastError = `${operationName}: Command timed out`;
      stats.lastErrorTime = new Date();
      updateStats(operationName, latency, false, "timeout");
      console.error(`[RedisCache] ${operationName} TIMEOUT after ${latency}ms`);
      return fallback;
    }

    if (isConnectionError) {
      stats.lastError = `${operationName}: ${errorMessage}`;
      stats.lastErrorTime = new Date();
      updateStats(operationName, latency, false, "connection");

      // 連線斷開，嘗試重建
      redis = reconnect();
      if (!redis) {
        console.error(
          `[RedisCache] ${operationName} connection error, reconnect failed (${latency}ms)`,
        );
        return fallback;
      }

      try {
        const retryStart = Date.now();
        const isReady = await waitForReady(redis);
        if (!isReady) {
          console.error(`[RedisCache] ${operationName} reconnect wait failed`);
          return fallback;
        }
        const retryResult = await operation(redis);
        const retryLatency = Date.now() - retryStart;
        updateStats(`${operationName}_retry`, retryLatency, true);
        console.log(
          `[RedisCache] ${operationName} retry succeeded (${retryLatency}ms)`,
        );
        return retryResult;
      } catch (retryError) {
        const retryLatency = Date.now() - startTime;
        updateStats(`${operationName}_retry`, retryLatency, false, "other");
        console.error(
          `[RedisCache] ${operationName} retry also failed (${retryLatency}ms)`,
        );
        return fallback;
      }
    }

    // 其他錯誤
    stats.lastError = `${operationName}: ${errorMessage}`;
    stats.lastErrorTime = new Date();
    updateStats(operationName, latency, false, "other");
    console.error(
      `[RedisCache] ${operationName} error after ${latency}ms:`,
      errorMessage,
    );
    return fallback;
  }
}

/**
 * 檢查 Redis 是否可用
 */
export function isRedisAvailable(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * 從快取獲取資料
 * @param key 快取 key
 * @returns 快取的資料，如果不存在則返回 null
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  return safeExecute(
    async (redis) => {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    },
    null,
    "GET",
  );
}

/**
 * 設定快取資料
 * @param key 快取 key
 * @param value 要快取的資料
 * @param ttlSeconds TTL 秒數
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<boolean> {
  return safeExecute(
    async (redis) => {
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    },
    false,
    "SET",
  );
}

/**
 * 刪除快取
 * @param key 快取 key（支援萬用字元）
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const operationName = key.includes("*") ? "DEL_SCAN" : "DEL";
  return safeExecute(
    async (redis) => {
      if (key.includes("*")) {
        // 使用 SCAN 刪除匹配的 keys（避免 KEYS 命令阻塞）
        let cursor = "0";
        do {
          const [nextCursor, keys] = await redis.scan(
            cursor,
            "MATCH",
            key,
            "COUNT",
            100,
          );
          cursor = nextCursor;
          if (keys.length > 0) {
            await redis.del(...keys);
          }
        } while (cursor !== "0");
      } else {
        await redis.del(key);
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
    `[RedisCache] Invalidated article list cache for company: ${companyId}`,
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
  console.log(`[RedisCache] Invalidated cache for article: ${articleId}`);
}

/** 快取統計資訊類型 */
interface CacheStats {
  connected: boolean;
  keyCount: number;
  memoryUsage: string;
}

/**
 * 快取統計資訊（來自 Redis INFO 命令）
 */
export async function getCacheStats(): Promise<CacheStats> {
  return safeExecute<CacheStats>(
    async (redis) => {
      const info = await redis.info("memory");
      const keyCount = await redis.dbsize();
      const memoryMatch = info.match(/used_memory_human:(\S+)/);

      return {
        connected: true,
        keyCount,
        memoryUsage: memoryMatch ? memoryMatch[1] : "unknown",
      };
    },
    { connected: false, keyCount: 0, memoryUsage: "0" },
    "INFO",
  );
}
