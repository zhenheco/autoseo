export interface ShoplineRateLimitStore {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
}

interface RateLimitWindow {
  count: number;
  windowStart: number;
}

export async function checkShoplineWriteRateLimit(
  store: ShoplineRateLimitStore,
  companyId: string,
  options: { limit?: number; windowSeconds?: number; now?: number } = {},
): Promise<{ allowed: true } | { allowed: false; retryAfter: number }> {
  const limit = options.limit ?? 60;
  const windowSeconds = options.windowSeconds ?? 60;
  const now = options.now ?? Date.now();
  const windowMs = windowSeconds * 1_000;
  const key = `shopline:rl:${companyId}`;

  const current = parseWindow(await store.get(key));
  if (!current || now - current.windowStart >= windowMs) {
    await store.put(key, JSON.stringify({ count: 1, windowStart: now }), {
      expirationTtl: windowSeconds,
    });
    return { allowed: true };
  }

  if (current.count >= limit) {
    const retryAfter = Math.max(
      1,
      Math.ceil((windowMs - (now - current.windowStart)) / 1_000),
    );
    return { allowed: false, retryAfter };
  }

  await store.put(
    key,
    JSON.stringify({
      count: current.count + 1,
      windowStart: current.windowStart,
    }),
    { expirationTtl: windowSeconds },
  );

  return { allowed: true };
}

function parseWindow(value: string | null): RateLimitWindow | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<RateLimitWindow>;
    if (
      typeof parsed.count === "number" &&
      Number.isFinite(parsed.count) &&
      typeof parsed.windowStart === "number" &&
      Number.isFinite(parsed.windowStart)
    ) {
      return {
        count: parsed.count,
        windowStart: parsed.windowStart,
      };
    }
  } catch {
    return null;
  }

  return null;
}
