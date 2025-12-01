import Redis from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
    });

    redis.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redis.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });

    redis.on("close", () => {
      console.log("[Redis] Connection closed");
    });
  }

  return redis;
}

export async function safeRedisGet<T>(key: string): Promise<T | null> {
  try {
    const data = await getRedis().get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(
      "[Redis] GET failed, falling back to DB:",
      (error as Error).message,
    );
    return null;
  }
}

export async function safeRedisSet(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("[Redis] SET failed:", (error as Error).message);
    return false;
  }
}

export async function safeRedisDel(key: string): Promise<boolean> {
  try {
    await getRedis().del(key);
    return true;
  } catch (error) {
    console.warn("[Redis] DEL failed:", (error as Error).message);
    return false;
  }
}

export async function safeRedisDelPattern(pattern: string): Promise<boolean> {
  try {
    const keys = await getRedis().keys(pattern);
    if (keys.length > 0) {
      await getRedis().del(...keys);
    }
    return true;
  } catch (error) {
    console.warn("[Redis] DEL pattern failed:", (error as Error).message);
    return false;
  }
}

export async function isRedisConnected(): Promise<boolean> {
  try {
    await getRedis().ping();
    return true;
  } catch {
    return false;
  }
}
