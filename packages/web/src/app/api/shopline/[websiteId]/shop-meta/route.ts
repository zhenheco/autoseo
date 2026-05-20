import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { safeJson } from "@/lib/api/request-body";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  forbidden,
  handleApiError,
  validationError,
} from "@/lib/api/response-helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getShoplineShopMeta,
  upsertShoplineShopMeta,
} from "@/lib/shopline/shop-meta-service";
import {
  checkShoplineWriteRateLimit,
  type ShoplineRateLimitStore,
} from "@/lib/shopline/rate-limiter";

type RouteContext = {
  params: Promise<{
    websiteId: string;
  }>;
};

const ShopMetaPatchSchema = z
  .object({
    seo_title_template: z.string().max(120).nullable().optional(),
    default_description: z.string().max(320).nullable().optional(),
    robots_index_products: z.boolean().optional(),
    robots_index_collections: z.boolean().optional(),
    sitemap_enabled: z.boolean().optional(),
    default_og_image: z.string().url().nullable().optional(),
    hreflang_map: z.record(z.string(), z.string().url()).nullable().optional(),
  })
  .strict();

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

function defaultShopMeta(websiteId: string) {
  return {
    website_id: websiteId,
    seo_title_template: null,
    default_description: null,
    robots_index_products: true,
    robots_index_collections: true,
    sitemap_enabled: true,
    default_og_image: null,
    hreflang_map: null,
  };
}

export const GET = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { companyId, supabase },
    context: RouteContext,
  ) => {
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

      const meta = await getShoplineShopMeta(supabase, websiteId);
      return NextResponse.json(meta ?? defaultShopMeta(websiteId));
    } catch (error) {
      return handleApiError(error);
    }
  },
);

export const PUT = withRouteAuth(
  "company",
  async (
    _request: NextRequest,
    { companyId, user, supabase },
    context: RouteContext,
  ) => {
    const request = _request as Pick<Request, "json"> & NextRequest;

    try {
      const { websiteId } = await context.params;
      const rateLimit = await checkShoplineWriteRateLimit(
        memoryRateLimitStore,
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

      const parsedBody = ShopMetaPatchSchema.safeParse(bodyResult.data);
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

      const updated = await upsertShoplineShopMeta(
        supabase,
        websiteId,
        parsedBody.data,
        { userId: user.id, source: "ui" },
      );

      return NextResponse.json(updated);
    } catch (error) {
      return handleApiError(error);
    }
  },
);
