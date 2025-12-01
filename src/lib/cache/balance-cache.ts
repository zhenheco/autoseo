import { safeRedisGet, safeRedisSet, safeRedisDel } from "./redis-client";

const PREFIX = "balance:";
const TTL = 20;

export interface CachedBalance {
  total: number;
  monthlyQuota: number;
  purchased: number;
  reserved: number;
  available: number;
  subscription: { tier: string; monthlyTokenQuota: number };
  plan: { name: string; slug: string } | null;
  cachedAt: number;
}

export async function getCachedBalance(
  companyId: string,
): Promise<CachedBalance | null> {
  return safeRedisGet<CachedBalance>(`${PREFIX}${companyId}`);
}

export async function setCachedBalance(
  companyId: string,
  balance: Omit<CachedBalance, "cachedAt">,
): Promise<boolean> {
  return safeRedisSet(
    `${PREFIX}${companyId}`,
    { ...balance, cachedAt: Date.now() },
    TTL,
  );
}

export async function invalidateBalanceCache(
  companyId: string,
): Promise<boolean> {
  console.log(`[BalanceCache] Invalidating cache for company: ${companyId}`);
  return safeRedisDel(`${PREFIX}${companyId}`);
}
