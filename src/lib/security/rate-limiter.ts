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
 * 檢查 Redis 連線是否可用
 */
function isConnectionReady(redis: Redis): boolean {
  return redis.status === "ready";
}

/**
 * 建立新的 Redis 客戶端
 */
function createRedisClient(): Redis {
  const client = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => {
      if (times > 2) {
        lastConnectionError = Date.now();
        return null;
      }
      return Math.min(times * 100, 1000);
    },
    enableOfflineQueue: false,
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 2000,
  });

  client.on("error", (err) => {
    lastConnectionError = Date.now();
    // 只在非預期錯誤時記錄
    if (!err.message.includes("Stream isn't writeable")) {
      console.error("[RateLimit] Redis connection error:", err.message);
    }
  });

  client.on("close", () => {
    // 連線關閉時清理客戶端
    if (redisClient === client) {
      redisClient = null;
    }
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

  // 冷卻機制：如果最近有連線錯誤，暫時跳過 Redis
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
    // 確保連線已建立
    if (!isConnectionReady(redis)) {
      await redis.connect();
    }
    return await operation(redis);
  } catch {
    // 第一次失敗，嘗試重建連線
    redis = reconnect();
    if (!redis) return fallback;

    try {
      await redis.connect();
      return await operation(redis);
    } catch (retryError) {
      // 重試也失敗，進入冷卻期
      lastConnectionError = Date.now();
      console.error("[RateLimit] Redis retry failed:", retryError);
      return fallback;
    }
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
  // 如果 Redis 未啟用，始終允許
  if (!isRedisEnabled()) {
    return {
      success: true,
      remaining: config.limit,
      reset: config.window,
      limit: config.limit,
    };
  }

  const key = `rate_limit:${identifier}`;

  // 使用 safeExecute 包裝 Redis 操作，失敗時優雅降級
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
    // fallback: Redis 不可用時允許請求通過
    {
      success: true,
      remaining: config.limit,
      reset: config.window,
      limit: config.limit,
    },
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
