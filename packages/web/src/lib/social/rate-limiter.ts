import type { Platform } from "./types";

export interface RateLimiter {
  acquire(platform: Platform, accountId: string): Promise<void>;
}

type BucketConfig = {
  capacity: number;
  intervalMs: number;
};

type BucketState = {
  tokens: number;
  updatedAt: number;
};

export class SocialRateLimitExceededError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(
      `Social publisher rate limit exceeded; retry after ${retryAfterMs}ms`,
    );
    this.name = "SocialRateLimitExceededError";
    this.retryAfterMs = retryAfterMs;
  }
}

export const SOCIAL_RATE_LIMIT_BUCKETS: Record<Platform, BucketConfig> = {
  instagram: { capacity: 200, intervalMs: 60 * 60 * 1000 },
  facebook: { capacity: 200, intervalMs: 60 * 60 * 1000 },
  threads: { capacity: 250, intervalMs: 24 * 60 * 60 * 1000 },
  x: { capacity: 1500, intervalMs: 30 * 24 * 60 * 60 * 1000 },
  linkedin: { capacity: 100, intervalMs: 24 * 60 * 60 * 1000 },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * In-memory token bucket limiter for the social publisher.
 *
 * Trade-off: this is atomic and fast inside a single Node/Worker instance, and
 * is enough while publishing runs in one region/queue worker. It is not a
 * global quota source across multiple regions or many concurrent isolates. If
 * social publishing fans out horizontally, replace this with a Postgres-backed
 * counter using a locked row per platform/account/window so every worker sees
 * the same bucket before it calls upstream APIs.
 */
export function createInMemorySocialRateLimiter(
  options: {
    buckets?: Partial<Record<Platform, BucketConfig>>;
    now?: () => number;
    maxWaitMs?: number;
  } = {},
): RateLimiter {
  const buckets = { ...SOCIAL_RATE_LIMIT_BUCKETS, ...options.buckets };
  const states = new Map<string, BucketState>();
  const now = options.now ?? (() => Date.now());
  const maxWaitMs = options.maxWaitMs ?? 0;

  return {
    async acquire(platform: Platform, accountId: string) {
      const config = buckets[platform];
      const key = `${platform}:${accountId}`;
      const currentTime = now();
      const state = states.get(key) ?? {
        tokens: config.capacity,
        updatedAt: currentTime,
      };
      const refillRate = config.capacity / config.intervalMs;
      const elapsedMs = Math.max(0, currentTime - state.updatedAt);
      const availableTokens = Math.min(
        config.capacity,
        state.tokens + elapsedMs * refillRate,
      );

      if (availableTokens >= 1) {
        states.set(key, {
          tokens: availableTokens - 1,
          updatedAt: currentTime,
        });
        return;
      }

      const retryAfterMs = Math.ceil((1 - availableTokens) / refillRate);
      if (retryAfterMs > maxWaitMs) {
        states.set(key, { tokens: availableTokens, updatedAt: currentTime });
        throw new SocialRateLimitExceededError(retryAfterMs);
      }

      await sleep(retryAfterMs);
      states.set(key, { tokens: 0, updatedAt: now() });
    },
  };
}
