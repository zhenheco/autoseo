import { safeRedisGet, safeRedisSet, safeRedisDel } from "./redis-client";

const PREFIX = "article_status:";
const TTL_ACTIVE = 15;
const TTL_TERMINAL = 60;

export interface CachedArticleStatus {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  current_step?: string;
  error_message?: string;
  result_url?: string;
  cachedAt: number;
}

export async function getCachedArticleStatus(
  jobId: string,
): Promise<CachedArticleStatus | null> {
  return safeRedisGet<CachedArticleStatus>(`${PREFIX}${jobId}`);
}

export async function setCachedArticleStatus(
  jobId: string,
  status: Omit<CachedArticleStatus, "cachedAt">,
): Promise<boolean> {
  const ttl = ["completed", "failed"].includes(status.status)
    ? TTL_TERMINAL
    : TTL_ACTIVE;
  return safeRedisSet(
    `${PREFIX}${jobId}`,
    { ...status, cachedAt: Date.now() },
    ttl,
  );
}

export async function invalidateArticleStatusCache(
  jobId: string,
): Promise<boolean> {
  console.log(`[ArticleStatusCache] Invalidating cache for job: ${jobId}`);
  return safeRedisDel(`${PREFIX}${jobId}`);
}
