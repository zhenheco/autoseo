import { createAdminClient } from "@/lib/supabase/server";
import crypto from "crypto";

const CACHE_TTL_DAYS = 7;

interface CacheResult {
  titles: string[];
  fromCache: boolean;
}

function generateCacheKey(keyword: string, targetLanguage: string): string {
  const normalized = keyword.toLowerCase().trim().replace(/\s+/g, " ");
  const input = `${normalized}:${targetLanguage}`;
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .substring(0, 64);
}

export async function getTitlesFromCache(
  keyword: string,
  targetLanguage: string,
): Promise<string[] | null> {
  const supabase = createAdminClient();
  const cacheKey = generateCacheKey(keyword, targetLanguage);

  const { data, error } = await supabase
    .from("title_cache")
    .select("titles")
    .eq("cache_key", cacheKey)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  await supabase
    .from("title_cache")
    .update({
      hit_count: supabase.rpc("increment_hit_count"),
      last_accessed_at: new Date().toISOString(),
    })
    .eq("cache_key", cacheKey);

  return data.titles as string[];
}

export async function saveTitlesToCache(
  keyword: string,
  targetLanguage: string,
  titles: string[],
): Promise<void> {
  const supabase = createAdminClient();
  const cacheKey = generateCacheKey(keyword, targetLanguage);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  await supabase.from("title_cache").upsert(
    {
      cache_key: cacheKey,
      keyword,
      target_language: targetLanguage,
      titles,
      expires_at: expiresAt.toISOString(),
      last_accessed_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
}

export async function getTitlesWithCache(
  keyword: string,
  targetLanguage: string,
  generateFn: () => Promise<string[]>,
): Promise<CacheResult> {
  const cached = await getTitlesFromCache(keyword, targetLanguage);

  if (cached && cached.length > 0) {
    return { titles: cached, fromCache: true };
  }

  const titles = await generateFn();

  if (titles.length > 0) {
    await saveTitlesToCache(keyword, targetLanguage, titles);
  }

  return { titles, fromCache: false };
}
