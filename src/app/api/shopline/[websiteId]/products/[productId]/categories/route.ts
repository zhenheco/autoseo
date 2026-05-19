import { NextResponse, type NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { safeJson } from "@/lib/api/request-body";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  forbidden,
  handleApiError,
  validationError,
} from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseShoplineConnectionStore } from "@/lib/shopline/connections";
import { updateShoplineProductCategories } from "@/lib/shopline/product-categorizer";
import {
  checkShoplineWriteRateLimit,
  type ShoplineRateLimitStore,
} from "@/lib/shopline/rate-limiter";
import { checkShoplineScope } from "@/lib/shopline/scope-guard";
import { getGrantedScopes } from "@/lib/shopline/scope-resolver";
import { ShoplineAuthError } from "@/lib/shopline/types";

type RouteContext = {
  params: Promise<{
    websiteId: string;
    productId: string;
  }>;
};

const CollectionIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);
const ProductCategoriesPatchSchema = z.object({
  add: z.array(CollectionIdSchema).max(50).default([]),
  remove: z.array(CollectionIdSchema).max(50).default([]),
});

const REQUIRED_CATEGORY_WRITE_SCOPES = [
  "write_products",
  "write_content",
] as const;

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

export const PATCH = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { companyId, user, supabase },
    context: RouteContext,
  ) => {
    const request = _request as Pick<Request, "json"> & NextRequest;

    try {
      const { websiteId, productId } = await context.params;
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

      const bodyResult = await safeJson<unknown>(request);
      if (!bodyResult.success) {
        return NextResponse.json(
          {
            error: bodyResult.error.message,
            code: bodyResult.error.code,
          },
          { status: 400 },
        );
      }

      const parsedBody = ProductCategoriesPatchSchema.safeParse(
        bodyResult.data,
      );
      if (!parsedBody.success) {
        return validationError(
          "Invalid request body",
          parsedBody.error.flatten(),
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

      const connectionStore =
        createSupabaseShoplineConnectionStore(adminClient);
      const grantedScopes = await getGrantedScopes(connectionStore, {
        companyId,
        websiteId,
      });
      const scopeCheck = checkShoplineScope(
        REQUIRED_CATEGORY_WRITE_SCOPES,
        grantedScopes,
      );

      if (!scopeCheck.ok) {
        return NextResponse.json(
          {
            error: "shopline_scope_missing",
            missing_scopes: scopeCheck.missing,
            reauthorize_url: `/api/oauth/shopline/install?siteId=${encodeURIComponent(
              websiteId,
            )}`,
          },
          { status: 403 },
        );
      }

      const result = await updateShoplineProductCategories(
        companyId,
        websiteId,
        productId,
        parsedBody.data,
        {
          store: connectionStore,
          auditOptions: {
            supabase,
            userId: user.id,
            source: "ui",
          },
        },
      );

      return NextResponse.json(result);
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
