/**
 * Redis 快取工具
 * 用於文章列表和內容的分散式快取
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
 * 取得 Redis 客戶端
 * 在 serverless 環境中優化連線處理
 */
function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  // 如果最近有連線錯誤，暫時跳過 Redis（冷卻機制）
  if (
    lastConnectionError &&
    Date.now() - lastConnectionError < CONNECTION_COOLDOWN
  ) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1, // 減少重試次數，避免阻塞
      retryStrategy: (times) => {
        if (times > 2) {
          // 超過重試次數，記錄錯誤時間並返回 null
          lastConnectionError = Date.now();
          return null;
        }
        return Math.min(times * 100, 1000);
      },
      enableOfflineQueue: false, // serverless 環境不使用離線佇列
      lazyConnect: true,
      connectTimeout: 3000, // 3 秒連線超時
      commandTimeout: 2000, // 2 秒命令超時
    });

    redisClient.on("error", (err) => {
      // 記錄連線錯誤時間，觸發冷卻機制
      lastConnectionError = Date.now();
      console.error("[RedisCache] Connection error:", err.message);
    });

    redisClient.on("close", () => {
      // 連線關閉時清理客戶端，下次會重新建立
      redisClient = null;
    });
  }

  return redisClient;
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
  const redis = getRedis();
  if (!redis) return null;

  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error("[RedisCache] Get error:", error);
    return null;
  }
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
  const redis = getRedis();
  if (!redis) return false;

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("[RedisCache] Set error:", error);
    return false;
  }
}

/**
 * 刪除快取
 * @param key 快取 key（支援萬用字元）
 */
export async function cacheDelete(key: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;

  try {
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
  } catch (error) {
    console.error("[RedisCache] Delete error:", error);
    return false;
  }
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

/**
 * 快取統計資訊
 */
export async function getCacheStats(): Promise<{
  connected: boolean;
  keyCount: number;
  memoryUsage: string;
} | null> {
  const redis = getRedis();
  if (!redis) return null;

  try {
    const info = await redis.info("memory");
    const keyCount = await redis.dbsize();
    const memoryMatch = info.match(/used_memory_human:(\S+)/);

    return {
      connected: true,
      keyCount,
      memoryUsage: memoryMatch ? memoryMatch[1] : "unknown",
    };
  } catch {
    return { connected: false, keyCount: 0, memoryUsage: "0" };
  }
}
