import { describe, expect, it, vi } from "vitest";
import {
  checkShoplineWriteRateLimit,
  type ShoplineRateLimitStore,
} from "../rate-limiter";

function createStore(): ShoplineRateLimitStore & {
  values: Map<string, string>;
  put: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, string>();

  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(
      async (
        key: string,
        value: string,
        _options?: { expirationTtl?: number },
      ) => {
        values.set(key, value);
      },
    ),
  };
}

describe("checkShoplineWriteRateLimit", () => {
  it("allows the first write and stores count 1", async () => {
    const store = createStore();

    await expect(
      checkShoplineWriteRateLimit(store, "company-1", {
        now: 1_000,
      }),
    ).resolves.toEqual({ allowed: true });

    expect(store.put).toHaveBeenCalledWith(
      "shopline:rl:company-1",
      JSON.stringify({ count: 1, windowStart: 1_000 }),
      { expirationTtl: 60 },
    );
  });

  it("allows the 60th write within the window", async () => {
    const store = createStore();

    for (let count = 1; count <= 60; count += 1) {
      await expect(
        checkShoplineWriteRateLimit(store, "company-1", {
          now: 1_000,
        }),
      ).resolves.toEqual({ allowed: true });
    }

    expect(
      JSON.parse(store.values.get("shopline:rl:company-1") ?? "{}"),
    ).toEqual({
      count: 60,
      windowStart: 1_000,
    });
  });

  it("rejects the 61st write with retryAfter for the remaining seconds", async () => {
    const store = createStore();

    for (let count = 1; count <= 60; count += 1) {
      await checkShoplineWriteRateLimit(store, "company-1", {
        now: 1_000,
      });
    }

    await expect(
      checkShoplineWriteRateLimit(store, "company-1", {
        now: 31_000,
      }),
    ).resolves.toEqual({ allowed: false, retryAfter: 30 });
  });

  it("resets the window after windowSeconds elapses", async () => {
    const store = createStore();

    store.values.set(
      "shopline:rl:company-1",
      JSON.stringify({ count: 60, windowStart: 1_000 }),
    );

    await expect(
      checkShoplineWriteRateLimit(store, "company-1", {
        now: 61_000,
      }),
    ).resolves.toEqual({ allowed: true });

    expect(
      JSON.parse(store.values.get("shopline:rl:company-1") ?? "{}"),
    ).toEqual({
      count: 1,
      windowStart: 61_000,
    });
  });
});
