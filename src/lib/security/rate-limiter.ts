/**
 * Rate Limiting 工具
 * 使用 Vercel KV 實現分散式速率限制
 */

import { kv } from "@vercel/kv";
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

/**
 * 檢查是否啟用 Vercel KV
 * 如果未配置，返回一個始終允許的結果（用於開發環境）
 */
function isKVEnabled(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
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
  // 如果 KV 未啟用，在開發環境中始終允許
  if (!isKVEnabled()) {
    console.warn(
      "[RateLimit] Vercel KV not configured, skipping rate limit check",
    );
    return {
      success: true,
      remaining: config.limit,
      reset: config.window,
      limit: config.limit,
    };
  }

  const key = `rate_limit:${identifier}`;

  try {
    const current = await kv.incr(key);

    // 如果是第一次請求，設定過期時間
    if (current === 1) {
      await kv.expire(key, config.window);
    }

    const ttl = await kv.ttl(key);

    return {
      success: current <= config.limit,
      remaining: Math.max(0, config.limit - current),
      reset: ttl > 0 ? ttl : config.window,
      limit: config.limit,
    };
  } catch (error) {
    console.error("[RateLimit] Error:", error);
    // 如果 KV 發生錯誤，預設允許請求（避免阻斷服務）
    return {
      success: true,
      remaining: config.limit,
      reset: config.window,
      limit: config.limit,
    };
  }
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
