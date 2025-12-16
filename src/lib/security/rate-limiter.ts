/**
 * Rate Limiting 工具
 * 使用 Redis (Zeabur/自建) 實現分散式速率限制
 *
 * 針對 Vercel serverless 環境優化：
 * - 連線狀態檢查和自動重連
 * - 優雅降級（Redis 不可用時允許請求通過）
 */

import Redis from "ioredis";
import { NextResponse } from "next/server";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  limit: number;
}

export interface RateLimitConfig {
  /** 時間窗口內允許的最大請求數 */
  limit: number;
  /** 時間窗口（秒） */
  window: number;
}

/** 預設 rate limit 配置 */
export const RATE_LIMIT_CONFIGS = {
  /** 文章生成 - 每用戶每分鐘 10 次 */
  ARTICLE_GENERATE: { limit: 10, window: 60 },
  /** 批量文章生成 - 每用戶每分鐘 5 次 */
  ARTICLE_GENERATE_BATCH: { limit: 5, window: 60 },
  /** 推薦碼驗證 - 每 IP 每分鐘 30 次 */
  REFERRAL_VALIDATE: { limit: 30, window: 60 },
  /** 聯盟申請 - 每用戶每小時 3 次 */
  AFFILIATE_APPLY: { limit: 3, window: 3600 },
  /** 登入嘗試 - 每 IP 每 15 分鐘 10 次 */
  LOGIN_ATTEMPT: { limit: 10, window: 900 },
  /** 認證相關操作 - 每 Email 每 5 分鐘 3 次（防止濫發驗證信） */
  AUTH_RESEND: { limit: 3, window: 300 },
  /** 一般 API - 每用戶每分鐘 60 次 */
  DEFAULT: { limit: 60, window: 60 },
} as const;

/** Redis 客戶端單例 */
let redisClient: Redis | null = null;
/** 最後一次連線錯誤時間 */
let lastConnectionError: number = 0;
/** 連線錯誤後的冷卻時間（毫秒） */
const CONNECTION_COOLDOWN = 5000;

/**
 * 記憶體 Rate Limit 快取（Redis 不可用時的備援）
 * 注意：Vercel serverless 環境下只能在單一實例內生效
 */
interface MemoryRateLimitEntry {
  count: number;
  expiresAt: number;
}
const memoryRateLimitCache = new Map<string, MemoryRateLimitEntry>();

/**
 * 記憶體快取 Rate Limit（Redis 不可用時使用）
 */
function memoryRateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const key = `rate_limit:${identifier}`;

  // 清理過期條目
  cleanupExpiredMemoryEntries();

  const existing = memoryRateLimitCache.get(key);

  if (existing && existing.expiresAt > now) {
    // 條目存在且未過期
    existing.count += 1;
    const remaining = Math.max(0, config.limit - existing.count);
    const reset = Math.ceil((existing.expiresAt - now) / 1000);

    return {
      success: existing.count <= config.limit,
      remaining,
      reset,
      limit: config.limit,
    };
  }

  // 建立新條目
  memoryRateLimitCache.set(key, {
    count: 1,
    expiresAt: now + config.window * 1000,
  });

  return {
    success: true,
    remaining: config.limit - 1,
    reset: config.window,
    limit: config.limit,
  };
}

/**
 * 清理過期的記憶體快取條目
 */
function cleanupExpiredMemoryEntries(): void {
  const now = Date.now();
  for (const [key, entry] of memoryRateLimitCache.entries()) {
    if (entry.expiresAt < now) {
      memoryRateLimitCache.delete(key);
    }
  }
}

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
      console.error("[RateLimit] Redis connection error:", err.message);
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
  return getRedisClient();
}

/**
 * 取得 Redis 客戶端
 * 使用單例模式避免重複連線
 */
function getRedisClient(): Redis | null {
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
  let redis = getRedisClient();
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
    console.error("[RateLimit] Operation error:", error);
    return fallback;
  }
}

/**
 * 檢查 Redis 是否啟用
 */
function isRedisEnabled(): boolean {
  return !!process.env.REDIS_URL;
}

/**
 * 執行 rate limiting 檢查
 * @param identifier 識別符（user_id, ip, etc.）
 * @param config rate limit 配置
 * @returns rate limit 結果
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.DEFAULT,
): Promise<RateLimitResult> {
  // 如果 Redis 未啟用，使用記憶體快取作為備援
  if (!isRedisEnabled()) {
    return memoryRateLimit(identifier, config);
  }

  const key = `rate_limit:${identifier}`;

  // 使用 safeExecute 包裝 Redis 操作，失敗時使用記憶體快取備援
  return safeExecute(
    async (redis) => {
      const current = await redis.incr(key);

      // 如果是第一次請求，設定過期時間
      if (current === 1) {
        await redis.expire(key, config.window);
      }

      const ttl = await redis.ttl(key);

      return {
        success: current <= config.limit,
        remaining: Math.max(0, config.limit - current),
        reset: ttl > 0 ? ttl : config.window,
        limit: config.limit,
      };
    },
    // fallback: Redis 不可用時使用記憶體快取備援（而非完全允許）
    memoryRateLimit(identifier, config),
  );
}

/**
 * 建立包含 rate limit headers 的 Response
 * @param result rate limit 結果
 * @returns headers 物件
 */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * 建立 rate limit 超過時的錯誤回應
 * @param result rate limit 結果
 * @returns NextResponse
 */
export function rateLimitExceededResponse(
  result: RateLimitResult,
): NextResponse {
  return NextResponse.json(
    {
      error: "請求過於頻繁，請稍後再試",
      retryAfter: result.reset,
    },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        "Retry-After": result.reset.toString(),
      },
    },
  );
}

/**
 * Rate limit 中間件 helper
 * 用於在 API route 開頭快速檢查
 * @param identifier 識別符
 * @param config rate limit 配置
 * @returns 如果超過限制，返回錯誤回應；否則返回 null
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.DEFAULT,
): Promise<NextResponse | null> {
  const result = await rateLimit(identifier, config);

  if (!result.success) {
    return rateLimitExceededResponse(result);
  }

  return null;
}

/**
 * 從 Request 中取得客戶端 IP
 * @param request NextRequest
 * @returns IP 地址
 */
export function getClientIP(request: Request): string {
  // Vercel 會在 x-forwarded-for header 中提供真實 IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // 其他常見的 header
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // 預設回傳 unknown
  return "unknown";
}
