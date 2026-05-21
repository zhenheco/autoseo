import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { withRouteAuth } from "@/lib/api/route-auth";
import { forbidden, handleApiError } from "@/lib/api/response-helpers";
import { createAdminClient } from "@shared/supabase";
import { deleteShoplineRedirect } from "@/lib/shopline/redirect-store";
import {
  checkShoplineWriteRateLimit,
  type ShoplineRateLimitStore,
} from "@/lib/shopline/rate-limiter";

type RouteContext = {
  params: Promise<{
    websiteId: string;
    redirectId: string;
  }>;
};

const memoryRateLimitValues = new Map<
  string,
  { value: string; expiresAt: number | null }
>();

const memoryRateLimitStore: ShoplineRateLimitStore = {
  async get(key) {
    const current = memoryRateLimitValues.get(key);
    if (!current) return null;

    if (current.expiresAt !== null && current.expiresAt <= Date.now()) {
      memoryRateLimitValues.delete(key);
      return null;
    }

    return current.value;
  },
  async put(key, value, options) {
    memoryRateLimitValues.set(key, {
      value,
      expiresAt: options?.expirationTtl
        ? Date.now() + options.expirationTtl * 1_000
        : null,
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

function getShoplineRateLimitStore(): ShoplineRateLimitStore {
  try {
    const { env } = getCloudflareContext();
    const bindings = env as Record<string, unknown>;
    const configuredBindingName = process.env.SHOPLINE_RATE_LIMIT_KV;
    const configuredBinding =
      typeof configuredBindingName === "string"
        ? bindings[configuredBindingName]
        : null;
    const kv =
      bindings.SHOPLINE_RATE_LIMIT_KV ?? configuredBinding ?? bindings.CACHE_KV;

    if (isRateLimitStore(kv)) {
      return kv;
    }
  } catch {
    return memoryRateLimitStore;
  }

  return memoryRateLimitStore;
}

function isRateLimitStore(value: unknown): value is ShoplineRateLimitStore {
  return (
    typeof value === "object" &&
    value !== null &&
    "get" in value &&
    "put" in value &&
    typeof (value as ShoplineRateLimitStore).get === "function" &&
    typeof (value as ShoplineRateLimitStore).put === "function"
  );
}

export const DELETE = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { companyId, supabase },
    context: RouteContext,
  ) => {
    try {
      const { websiteId, redirectId } = await context.params;
      const rateLimit = await checkShoplineWriteRateLimit(
        getShoplineRateLimitStore(),
        companyId,
      );

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: "shopline_rate_limited",
            retryAfter: rateLimit.retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": rateLimit.retryAfter.toString(),
            },
          },
        );
      }

      const adminClient = createAdminClient();
      const ownsWebsite = await assertWebsiteOwner(
        adminClient,
        companyId,
        websiteId,
      );

      if (!ownsWebsite) {
        return forbidden("Website not found");
      }

      await deleteShoplineRedirect(supabase, redirectId);

      return new NextResponse(null, { status: 204 });
    } catch (error) {
      return handleApiError(error);
    }
  },
);
