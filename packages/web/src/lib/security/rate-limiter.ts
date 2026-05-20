/**
 * Rate Limiting 工具（使用 Cloudflare KV）
 * 使用 KV 實現分散式速率限制
 *
 * 適合 serverless 環境：
 * - 無連線管理問題
 * - 全球邊緣位置，低延遲
 * - Eventually consistent（對 rate limiting 可接受）
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";
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

/**
 * 記憶體 Rate Limit 快取（KV 不可用時的備援）
 * 注意：serverless 環境下只能在單一實例內生效
 */
interface MemoryRateLimitEntry {
  count: number;
  expiresAt: number;
}
const memoryRateLimitCache = new Map<string, MemoryRateLimitEntry>();

/**
 * 記憶體快取 Rate Limit（KV 不可用時使用）
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

/** KV rate limit 資料結構 */
interface KVRateLimitData {
  count: number;
  windowStart: number;
}

/**
 * 取得 KV binding
 */
function getKV(): KVNamespace | null {
  try {
    const { env } = getCloudflareContext();
    const kv = (env as Record<string, unknown>).CACHE_KV as
      | KVNamespace
      | undefined;
    return kv || null;
  } catch {
    return null;
  }
}

/**
 * 執行 rate limiting 檢查
 *
 * 策略：memory-first, KV-assisted
 * - 記憶體計數器是原子性的（同一 isolate 內無 race condition）
 * - KV 僅作為跨節點的「盡力而為」輔助限速
 * - 任一層超限即拒絕（取嚴格值）
 *
 * @param identifier 識別符（user_id, ip, etc.）
 * @param config rate limit 配置
 * @returns rate limit 結果
 */
export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMIT_CONFIGS.DEFAULT,
): Promise<RateLimitResult> {
  // 記憶體層：原子性保證，永遠先檢查
  const memResult = memoryRateLimit(identifier, config);
  if (!memResult.success) {
    return memResult;
  }

  // KV 層：跨節點輔助（盡力而為，非原子性可接受）
  const kv = getKV();
  if (!kv) {
    return memResult;
  }

  const key = `rate_limit:${identifier}`;
  const now = Date.now();

  try {
    const existing = await kv.get<KVRateLimitData>(key, "json");

    if (existing && now - existing.windowStart < config.window * 1000) {
      const newCount = existing.count + 1;
      const remainingTtl = Math.ceil(
        (config.window * 1000 - (now - existing.windowStart)) / 1000,
      );
      const effectiveTtl = Math.max(60, remainingTtl);

      await kv.put(
        key,
        JSON.stringify({ count: newCount, windowStart: existing.windowStart }),
        { expirationTtl: effectiveTtl },
      );

      // 如果 KV 層也超限，以 KV 結果為準（跨節點累計）
      if (newCount > config.limit) {
        return {
          success: false,
          remaining: 0,
          reset: remainingTtl > 0 ? remainingTtl : config.window,
          limit: config.limit,
        };
      }
    } else {
      const effectiveTtl = Math.max(60, config.window);
      await kv.put(key, JSON.stringify({ count: 1, windowStart: now }), {
        expirationTtl: effectiveTtl,
      });
    }
  } catch (error) {
    console.error("[RateLimit] KV error (non-blocking):", error);
  }

  return memResult;
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
  // Cloudflare 會在 CF-Connecting-IP header 中提供真實 IP
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) {
    return cfIP;
  }

  // Fallback: x-forwarded-for
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
