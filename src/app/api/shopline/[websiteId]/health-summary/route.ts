import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { withRouteAuth } from "@/lib/api/route-auth";
import { forbidden, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchShoplineCollections } from "@/lib/shopline/collection-fetcher";
import { createSupabaseShoplineConnectionStore } from "@/lib/shopline/connections";
import { fetchShoplineProducts } from "@/lib/shopline/product-fetcher";
import {
  evaluateBatchSeoHealth,
  type SeoHealthFlag,
  type SeoHealthInput,
} from "@/lib/shopline/seo-health-evaluator";
import { ShoplineAuthError } from "@/lib/shopline/types";

const HEALTH_CACHE_TTL_SECONDS = 300;

type RouteContext = {
  params: Promise<{
    websiteId: string;
  }>;
};

type HealthSummaryCounts = {
  missingSeoTitle: number;
  seoTitleTooLong: number;
  missingSeoDescription: number;
  seoDescriptionTooLong: number;
  missingAlt: number;
  duplicateTitle: number;
};

type HealthSummaryResponse = {
  counts: HealthSummaryCounts;
};

type HealthCacheStore = {
  get<T>(key: string, type?: "json"): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
};

type MemoryHealthCacheEntry = {
  value: unknown;
  expiresAt: number;
};

const memoryHealthCache = new Map<string, MemoryHealthCacheEntry>();

const flagToCountKey: Record<SeoHealthFlag, keyof HealthSummaryCounts> = {
  missing_seo_title: "missingSeoTitle",
  seo_title_too_long: "seoTitleTooLong",
  missing_seo_description: "missingSeoDescription",
  seo_description_too_long: "seoDescriptionTooLong",
  missing_alt: "missingAlt",
  duplicate_title: "duplicateTitle",
};

const memoryHealthCacheStore: HealthCacheStore = {
  async get<T>(key: string) {
    const existing = memoryHealthCache.get(key);
    if (!existing) return null;

    if (existing.expiresAt <= Date.now()) {
      memoryHealthCache.delete(key);
      return null;
    }

    return existing.value as T;
  },
  async put(key: string, value: string, options?: { expirationTtl?: number }) {
    const ttl = options?.expirationTtl ?? HEALTH_CACHE_TTL_SECONDS;
    memoryHealthCache.set(key, {
      value: JSON.parse(value),
      expiresAt: Date.now() + ttl * 1000,
    });
  },
};

async function assertWebsiteOwner(
  adminClient: ReturnType<typeof createAdminClient>,
  companyId: string,
  websiteId: string,
) {
  const { data: website, error } = await adminClient
    .from("website_configs")
    .select("id")
    .eq("id", websiteId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(website);
}

function isHealthCacheStore(value: unknown): value is HealthCacheStore {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    "put" in value &&
    typeof (value as HealthCacheStore).get === "function" &&
    typeof (value as HealthCacheStore).put === "function"
  );
}

function getHealthCacheStore(): HealthCacheStore {
  try {
    const { env } = getCloudflareContext();
    const kv = (env as Record<string, unknown>).CACHE_KV;

    if (isHealthCacheStore(kv)) {
      return kv;
    }
  } catch {
    return memoryHealthCacheStore;
  }

  return memoryHealthCacheStore;
}

function createEmptyCounts(): HealthSummaryCounts {
  return {
    missingSeoTitle: 0,
    seoTitleTooLong: 0,
    missingSeoDescription: 0,
    seoDescriptionTooLong: 0,
    missingAlt: 0,
    duplicateTitle: 0,
  };
}

function aggregateHealthCounts(
  items: Array<SeoHealthInput & { id: string }>,
): HealthSummaryCounts {
  const counts = createEmptyCounts();
  const healthById = evaluateBatchSeoHealth(items);

  for (const flags of healthById.values()) {
    for (const flag of flags) {
      counts[flagToCountKey[flag]] += 1;
    }
  }

  return counts;
}

export const GET = withRouteAuth(
  "company",
  async (_request: NextRequest, { companyId }, context: RouteContext) => {
    try {
      const { websiteId } = await context.params;
      const adminClient = createAdminClient();
      const ownsWebsite = await assertWebsiteOwner(
        adminClient,
        companyId,
        websiteId,
      );

      if (!ownsWebsite) {
        return forbidden("Website not found");
      }

      const cache = getHealthCacheStore();
      const cacheKey = `shopline:health:${websiteId}`;
      const cached = await cache.get<HealthSummaryResponse>(cacheKey, "json");

      if (cached) {
        return NextResponse.json(cached, {
          headers: { "X-Cache": "HIT" },
        });
      }

      const store = createSupabaseShoplineConnectionStore(adminClient);
      const [productsResult, collectionsResult] = await Promise.all([
        fetchShoplineProducts(companyId, websiteId, undefined, { store }),
        fetchShoplineCollections(companyId, websiteId, null, { store }),
      ]);
      const items: Array<SeoHealthInput & { id: string }> = [
        ...productsResult.products.map((product) => ({
          id: product.id,
          entityType: "product" as const,
          entity: product,
        })),
        ...collectionsResult.collections.map((collection) => ({
          id: collection.id,
          entityType: "collection" as const,
          entity: collection,
        })),
      ];
      const responseBody: HealthSummaryResponse = {
        counts: aggregateHealthCounts(items),
      };

      await cache.put(cacheKey, JSON.stringify(responseBody), {
        expirationTtl: HEALTH_CACHE_TTL_SECONDS,
      });

      return NextResponse.json(responseBody, {
        headers: { "X-Cache": "MISS" },
      });
    } catch (error) {
      if (
        error instanceof ShoplineAuthError ||
        (error instanceof Error &&
          (error.name === "ShoplineAuthError" ||
            error.message === "shopline_auth_invalid"))
      ) {
        const { websiteId } = await context.params;

        return NextResponse.json(
          {
            error: "shopline_auth_invalid",
            reauthorize_url: `/api/oauth/shopline/install?siteId=${encodeURIComponent(
              websiteId,
            )}`,
          },
          { status: 502 },
        );
      }

      if (
        error instanceof Error &&
        error.message === "shopline_no_connection"
      ) {
        return NextResponse.json(
          { error: "shopline_no_connection" },
          { status: 404 },
        );
      }

      return handleApiError(error);
    }
  },
);
