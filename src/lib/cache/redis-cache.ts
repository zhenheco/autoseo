/**
 * Redis 快取工具
 * 用於文章列表和內容的分散式快取
 *
 * 針對 Vercel serverless 環境優化：
 * - 連線狀態檢查和自動重連
 * - 優雅降級（Redis 不可用時 fallback 到資料庫）
 */

import Redis from "ioredis";

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
 */
async function safeExecute<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: T,
): Promise<T> {
  let redis = getRedis();
  if (!redis) return fallback;

  try {
    // 等待連接就緒（如果正在連接中）
    if (redis.status !== "ready") {
      const isReady = await waitForReady(redis);
      if (!isReady) {
        // 連接失敗，嘗試重建
        redis = reconnect();
        if (!redis) return fallback;
        const retryReady = await waitForReady(redis);
        if (!retryReady) {
          lastConnectionError = Date.now();
          return fallback;
        }
      }
    }
    return await operation(redis);
  } catch (error) {
    // 檢查是否為連線斷開錯誤
    const isConnectionError =
      error instanceof Error &&
      (error.message.includes("Stream isn't writeable") ||
        error.message.includes("Connection is closed"));

    if (isConnectionError) {
      // 連線斷開，嘗試重建
      redis = reconnect();
      if (!redis) return fallback;

      try {
        const isReady = await waitForReady(redis);
        if (!isReady) return fallback;
        return await operation(redis);
      } catch {
        // 重試也失敗
        return fallback;
      }
    }

    // 其他錯誤，直接返回 fallback
    console.error("[RedisCache] Operation error:", error);
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
  return safeExecute(async (redis) => {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  }, null);
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
  return safeExecute(async (redis) => {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  }, false);
}

/**
 * 刪除快取
 * @param key 快取 key（支援萬用字元）
 */
export async function cacheDelete(key: string): Promise<boolean> {
  return safeExecute(async (redis) => {
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
  }, false);
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
 * 快取統計資訊
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
  );
}
