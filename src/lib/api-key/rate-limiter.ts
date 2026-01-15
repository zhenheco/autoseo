/**
 * API Rate Limiter
 *
 * 使用 Redis 實作滑動視窗速率限制
 * 預設：每分鐘 100 次請求
 */

import { Redis } from "@upstash/redis";

// Redis 客戶端
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * Rate Limit 設定
 */
export interface RateLimitConfig {
  /** 時間視窗（秒） */
  windowSeconds: number;
  /** 視窗內最大請求數 */
  maxRequests: number;
}

/**
 * Rate Limit 結果
 */
export interface RateLimitResult {
  /** 是否允許請求 */
  allowed: boolean;
  /** 剩餘請求數 */
  remaining: number;
  /** 重置時間（Unix timestamp） */
  resetAt: number;
  /** 已使用的請求數 */
  used: number;
  /** 限制數量 */
  limit: number;
}

/**
 * 預設設定：每分鐘 100 次
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowSeconds: 60,
  maxRequests: 100,
};

/**
 * 檢查並更新速率限制
 *
 * @param identifier 識別符（通常是 API Key 或網站 ID）
 * @param config Rate limit 設定
 * @returns Rate limit 結果
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    // 使用 Redis pipeline 執行多個命令
    const pipeline = redis.pipeline();

    // 移除過期的請求記錄
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 計算當前視窗內的請求數
    pipeline.zcard(key);

    // 執行 pipeline
    const results = await pipeline.exec();
    const currentCount = (results[1] as number) || 0;

    // 檢查是否超過限制
    if (currentCount >= config.maxRequests) {
      // 取得最早的請求時間來計算重置時間
      const oldestRequests = await redis.zrange(key, 0, 0, {
        withScores: true,
      });
      const oldestTime =
        oldestRequests.length > 0
          ? (oldestRequests[0] as { score: number }).score ||
            (oldestRequests[1] as number)
          : now;
      const resetAt = Math.ceil(oldestTime) + config.windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        used: currentCount,
        limit: config.maxRequests,
      };
    }

    // 新增請求記錄
    const requestId = `${now}:${Math.random().toString(36).substring(7)}`;
    await redis.zadd(key, { score: now, member: requestId });

    // 設定過期時間（視窗時間 + 緩衝）
    await redis.expire(key, config.windowSeconds + 10);

    const resetAt = now + config.windowSeconds;

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetAt,
      used: currentCount + 1,
      limit: config.maxRequests,
    };
  } catch (error) {
    console.error("[Rate Limiter] Error:", error);

    // Redis 錯誤時，預設允許請求（fail open）
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowSeconds,
      used: 0,
      limit: config.maxRequests,
    };
  }
}

/**
 * 取得當前速率限制狀態（不增加計數）
 *
 * @param identifier 識別符
 * @param config Rate limit 設定
 * @returns 當前狀態
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    // 移除過期記錄並計數
    await redis.zremrangebyscore(key, 0, windowStart);
    const currentCount = await redis.zcard(key);

    return {
      allowed: currentCount < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - currentCount),
      resetAt: now + config.windowSeconds,
      used: currentCount,
      limit: config.maxRequests,
    };
  } catch (error) {
    console.error("[Rate Limiter] Error getting status:", error);

    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowSeconds,
      used: 0,
      limit: config.maxRequests,
    };
  }
}

/**
 * 建立 Rate Limit 回應 headers
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", result.resetAt.toString());
  headers.set("X-RateLimit-Used", result.used.toString());
  return headers;
}

/**
 * 建立 429 Too Many Requests 回應
 */
export function createRateLimitExceededResponse(
  result: RateLimitResult,
): Response {
  const headers = createRateLimitHeaders(result);
  headers.set("Content-Type", "application/json");
  headers.set(
    "Retry-After",
    (result.resetAt - Math.floor(Date.now() / 1000)).toString(),
  );

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded. Please retry after ${result.resetAt - Math.floor(Date.now() / 1000)} seconds.`,
      },
      rateLimit: {
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt,
      },
    }),
    {
      status: 429,
      headers,
    },
  );
}
