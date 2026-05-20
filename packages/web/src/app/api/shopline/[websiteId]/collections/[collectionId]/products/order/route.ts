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
import { createAdminClient } from "@shared/supabase";
import { ShoplineClient } from "@/lib/shopline/client";
import {
  createSupabaseShoplineConnectionStore,
  resolveShoplineAccessToken,
} from "@/lib/shopline/connections";
import {
  checkShoplineWriteRateLimit,
  type ShoplineRateLimitStore,
} from "@/lib/shopline/rate-limiter";
import { checkShoplineScope } from "@/lib/shopline/scope-guard";
import { getGrantedScopes } from "@/lib/shopline/scope-resolver";
import { ShoplineAuthError } from "@/lib/shopline/types";
import type { Database } from "@/types/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{
    websiteId: string;
    collectionId: string;
  }>;
};

const ProductOrderSchema = z.object({
  order: z
    .array(
      z.object({
        productId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
        position: z.number(),
      }),
    )
    .max(200),
});

const REQUIRED_PRODUCT_ORDER_SCOPES = ["write_content"] as const;

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

    if (isRateLimitStore(kv)) return kv;
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
      const { websiteId, collectionId } = await context.params;
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
            headers: { "Retry-After": rateLimit.retryAfter.toString() },
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

      const parsedBody = ProductOrderSchema.safeParse(bodyResult.data);
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
      if (!ownsWebsite) return forbidden("Website not found");

      const connectionStore =
        createSupabaseShoplineConnectionStore(adminClient);
      const grantedScopes = await getGrantedScopes(connectionStore, {
        companyId,
        websiteId,
      });
      const scopeCheck = checkShoplineScope(
        REQUIRED_PRODUCT_ORDER_SCOPES,
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

      const auth = await resolveShoplineAccessToken(connectionStore, {
        companyId,
        websiteId,
      });
      const client = new ShoplineClient({
        shopHandle: auth.shopHandle,
        accessToken: auth.accessToken,
      });

      await client.reorderCollectionProducts(
        collectionId,
        parsedBody.data.order,
      );
      await insertProductOrderAudit(supabase, {
        companyId,
        websiteId,
        collectionId,
        userId: user.id,
        order: parsedBody.data.order,
      });

      return NextResponse.json({ ok: true });
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
        (error.message === "shopline_connection_not_found" ||
          error.message === "shopline_connection_token_missing")
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

async function insertProductOrderAudit(
  supabase: SupabaseClient<Database>,
  params: {
    companyId: string;
    websiteId: string;
    collectionId: string;
    userId: string;
    order: Array<{ productId: string; position: number }>;
  },
) {
  const { error } = await supabase.from("shopline_seo_audit_log").insert([
    {
      company_id: params.companyId,
      website_id: params.websiteId,
      entity_type: "collection",
      entity_id: params.collectionId,
      field: "products.position",
      before_value: null,
      after_value: JSON.stringify(params.order),
      source: "ui",
      model: null,
      user_id: params.userId,
    },
  ]);

  if (error) {
    console.warn(
      "[shopline-product-order-route] audit insert failed:",
      error.message,
    );
  }
}
