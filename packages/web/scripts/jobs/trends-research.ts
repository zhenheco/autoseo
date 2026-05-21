#!/usr/bin/env tsx

import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  AiGatewayLLMSynthesizer,
  createTrendsAggregator,
  HttpGoogleTrendsRssClient,
  HttpGSCClient,
  HttpPerplexityClient,
  persistSignals as persistTrendSignals,
  type TrendSignal,
  type TrendsAggregator,
} from "../../src/lib/trends";

type SupabaseClientLike = {
  from(table: string): SupabaseQueryBuilder;
};

type SupabaseQueryResult<T = unknown> = {
  data?: T | null;
  error?: { message?: string } | null;
};

type SupabaseQueryBuilder = PromiseLike<SupabaseQueryResult> & {
  select(columns: string): SupabaseQueryBuilder;
  is(column: string, value: unknown): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  in(column: string, values: unknown[]): SupabaseQueryBuilder;
  order(
    column: string,
    options?: Record<string, unknown>,
  ): SupabaseQueryBuilder;
};

export type TrendsResearchBrand = {
  id: string;
  name: string;
  keywords: string[];
  industry?: string;
  geography?: string;
  gscSiteUrl?: string;
};

export type TrendsResearchBrandResult =
  | {
      brandId: string;
      brandName: string;
      status: "success";
      fetched: number;
      inserted: number;
      skipped: number;
    }
  | {
      brandId: string;
      brandName: string;
      status: "failed";
      error: string;
    };

type TrendsResearchLogger = Pick<typeof console, "error" | "log" | "warn">;

export type TrendsResearchDeps = {
  loadBrandsWithKeywords(): Promise<TrendsResearchBrand[]>;
  aggregator: TrendsAggregator;
  persistSignals(
    brandId: string,
    signals: TrendSignal[],
  ): Promise<{ inserted: number; skipped: number }>;
  logger?: TrendsResearchLogger;
};

export type TrendsResearchRunResult = {
  brands: TrendsResearchBrandResult[];
  totals: {
    processed: number;
    failed: number;
    inserted: number;
    skipped: number;
  };
};

function uniqueKeywords(keywords: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      keywords
        .map((keyword) => keyword?.trim())
        .filter((keyword): keyword is string => Boolean(keyword)),
    ),
  ];
}

export async function loadBrandsWithKeywords(
  supabase: SupabaseClientLike,
): Promise<TrendsResearchBrand[]> {
  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (brandsError) {
    throw new Error(brandsError.message || "Failed to load brands");
  }

  const activeBrands = Array.isArray(brands)
    ? (brands as Array<{ id: string; name: string }>)
    : [];
  if (activeBrands.length === 0) return [];

  const brandIds = activeBrands.map((brand) => brand.id);
  const [{ data: keywordRows, error: keywordError }, websiteResult] =
    await Promise.all([
      supabase
        .from("brand_keywords")
        .select("brand_id, keyword")
        .in("brand_id", brandIds),
      supabase
        .from("website_configs")
        .select("brand_id, wordpress_url")
        .eq("is_active", true)
        .in("brand_id", brandIds),
    ]);

  if (keywordError) {
    throw new Error(keywordError.message || "Failed to load brand keywords");
  }
  if (websiteResult.error) {
    throw new Error(
      websiteResult.error.message || "Failed to load brand websites",
    );
  }

  const keywordsByBrand = new Map<string, string[]>();
  for (const row of (keywordRows ?? []) as Array<{
    brand_id: string | null;
    keyword: string | null;
  }>) {
    if (!row.brand_id) continue;
    keywordsByBrand.set(row.brand_id, [
      ...(keywordsByBrand.get(row.brand_id) ?? []),
      row.keyword ?? "",
    ]);
  }

  const gscSiteByBrand = new Map<string, string>();
  for (const row of (websiteResult.data ?? []) as Array<{
    brand_id: string | null;
    wordpress_url: string | null;
  }>) {
    if (
      !row.brand_id ||
      !row.wordpress_url ||
      gscSiteByBrand.has(row.brand_id)
    ) {
      continue;
    }
    gscSiteByBrand.set(row.brand_id, row.wordpress_url);
  }

  return activeBrands.flatMap((brand) => {
    const keywords = uniqueKeywords(keywordsByBrand.get(brand.id) ?? []);
    if (keywords.length === 0) return [];

    return [
      {
        id: brand.id,
        name: brand.name,
        industry: brand.name,
        keywords,
        gscSiteUrl: gscSiteByBrand.get(brand.id),
      },
    ];
  });
}

export async function runTrendsResearch(
  deps: TrendsResearchDeps,
): Promise<TrendsResearchRunResult> {
  const logger = deps.logger ?? console;
  const brands = await deps.loadBrandsWithKeywords();
  const results: TrendsResearchBrandResult[] = [];

  logger.log(`[Trends Research] Loaded ${brands.length} active brands`);

  for (const brand of brands) {
    try {
      const signals = await deps.aggregator.fetchTrends(brand);
      const persisted = await deps.persistSignals(brand.id, signals);

      const result: TrendsResearchBrandResult = {
        brandId: brand.id,
        brandName: brand.name,
        status: "success",
        fetched: signals.length,
        inserted: persisted.inserted,
        skipped: persisted.skipped,
      };
      results.push(result);

      logger.log(
        `[Trends Research] ${brand.name}: fetched=${result.fetched} inserted=${result.inserted} skipped=${result.skipped}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        brandId: brand.id,
        brandName: brand.name,
        status: "failed",
        error: message,
      });
      logger.error(`[Trends Research] ${brand.name}: failed`, error);
    }
  }

  return {
    brands: results,
    totals: {
      processed: results.filter((result) => result.status === "success").length,
      failed: results.filter((result) => result.status === "failed").length,
      inserted: results.reduce(
        (total, result) =>
          total + (result.status === "success" ? result.inserted : 0),
        0,
      ),
      skipped: results.reduce(
        (total, result) =>
          total + (result.status === "success" ? result.skipped : 0),
        0,
      ),
    },
  };
}

function getGatewayBaseUrl(provider: "google-ai-studio" | "perplexity-ai") {
  const enabled = process.env.CF_AI_GATEWAY_ENABLED === "true";
  const accountId =
    process.env.CF_AI_GATEWAY_ACCOUNT_ID || process.env.CF_AI_ACCOUNT_ID;
  const gatewayId = process.env.CF_AI_GATEWAY_ID;

  if (!enabled || !accountId || !gatewayId) return null;
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${provider}`;
}

function createProductionAggregator(): TrendsAggregator {
  const cfAigToken = process.env.CF_AI_GATEWAY_TOKEN || undefined;
  const perplexityEndpoint =
    getGatewayBaseUrl("perplexity-ai") ||
    process.env.PERPLEXITY_API_BASE_URL ||
    "https://api.perplexity.ai";
  const geminiEndpoint =
    getGatewayBaseUrl("google-ai-studio") ||
    process.env.GEMINI_API_BASE_URL ||
    "https://generativelanguage.googleapis.com";
  const gscToken =
    process.env.GSC_ACCESS_TOKEN ||
    process.env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN ||
    "";

  return createTrendsAggregator({
    perplexityClient: new HttpPerplexityClient({
      apiKey: process.env.PERPLEXITY_API_KEY || "",
      endpoint: perplexityEndpoint,
      cfAigToken,
      model: process.env.PERPLEXITY_MODEL || "sonar",
    }),
    gscClient: gscToken
      ? new HttpGSCClient({
          apiKey: gscToken,
          endpoint:
            process.env.GSC_API_BASE_URL ||
            "https://www.googleapis.com/webmasters/v3",
        })
      : null,
    googleTrendsClient: new HttpGoogleTrendsRssClient({
      endpoint:
        process.env.GOOGLE_TRENDS_RSS_URL ||
        "https://trends.google.com/trending/rss?geo=US",
      geo: process.env.GOOGLE_TRENDS_GEO,
    }),
    llmSynthesizer: new AiGatewayLLMSynthesizer({
      apiKey: process.env.GEMINI_API_KEY || "",
      endpoint: geminiEndpoint,
      cfAigToken,
      model: process.env.TRENDS_LLM_MODEL || "gemini-2.0-flash",
    }),
  });
}

function createProductionDeps(): TrendsResearchDeps {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as unknown as SupabaseClientLike;

  return {
    loadBrandsWithKeywords: () => loadBrandsWithKeywords(supabase),
    aggregator: createProductionAggregator(),
    persistSignals: (brandId, signals) =>
      persistTrendSignals(brandId, signals, { supabase }),
  };
}

async function main() {
  const result = await runTrendsResearch(createProductionDeps());
  console.log("[Trends Research] Complete", result.totals);

  if (result.totals.failed > 0) {
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error("[Trends Research] Fatal error", error);
    process.exitCode = 1;
  });
}
