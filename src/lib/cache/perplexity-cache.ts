import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

export interface CacheOptions {
  companyId: string;
  queryType: "competitor_research" | "industry_analysis" | "market_trends";
  queryParams: Record<string, unknown>;
  ttlDays?: number;
}

export interface CachedData<T = unknown> {
  data: T;
  cachedAt: string;
  expiresAt: string;
}

const DEFAULT_TTL_DAYS = 7;

function generateQueryHash(params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>,
    );

  const paramString = JSON.stringify(sortedParams);
  return crypto.createHash("sha256").update(paramString).digest("hex");
}

export async function getCachedData<T = unknown>(
  options: CacheOptions,
): Promise<CachedData<T> | null> {
  const supabase = await createClient();
  const queryHash = generateQueryHash(options.queryParams);

  const { data, error } = await supabase
    .from("perplexity_cache")
    .select("response_data, created_at, expires_at")
    .eq("company_id", options.companyId)
    .eq("query_hash", queryHash)
    .eq("query_type", options.queryType)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  return {
    data: data.response_data as T,
    cachedAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

export async function setCachedData<T = unknown>(
  options: CacheOptions,
  responseData: T,
): Promise<void> {
  const supabase = await createClient();
  const queryHash = generateQueryHash(options.queryParams);
  const ttlDays = options.ttlDays || DEFAULT_TTL_DAYS;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + ttlDays);

  await supabase.from("perplexity_cache").upsert(
    {
      company_id: options.companyId,
      query_hash: queryHash,
      query_type: options.queryType,
      query_params: options.queryParams,
      response_data: responseData,
      expires_at: expiresAt.toISOString(),
    },
    {
      onConflict: "company_id,query_hash",
    },
  );
}

export async function clearExpiredCache(): Promise<void> {
  const supabase = await createClient();

  await supabase.rpc("cleanup_expired_cache");
}

export async function clearCompanyCache(companyId: string): Promise<void> {
  const supabase = await createClient();

  await supabase.from("perplexity_cache").delete().eq("company_id", companyId);
}
