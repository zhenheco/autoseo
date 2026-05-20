import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { withRouteAuth } from "@/lib/api/route-auth";
import {
  forbidden,
  handleApiError,
  validationError,
} from "@/lib/api/response-helpers";
import { safeJson } from "@/lib/api/request-body";
import { createAdminClient } from "@shared/supabase";
import { callShoplineAiSeoModel } from "@/lib/shopline/ai-seo-call-model";
import { generateShoplineSeoDraft } from "@/lib/shopline/ai-seo-generator";
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
import type { ShoplineProduct } from "@/lib/shopline/types";
import { ShoplineAuthError } from "@/lib/shopline/types";

type RouteContext = {
  params: Promise<{
    websiteId: string;
  }>;
};

const AiSeoPostSchema = z
  .object({
    entityType: z.enum(["product", "collection", "image"]),
    entityId: z.string().min(1),
    productId: z.string().min(1).optional(),
    fields: z.array(z.enum(["seoTitle", "seoDescription", "alt"])).min(1),
  })
  .superRefine((value, context) => {
    if (value.entityType === "image" && !value.productId) {
      context.addIssue({
        code: "custom",
        path: ["productId"],
        message: "productId is required for image AI SEO drafts",
      });
    }
  });

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

function requiredScopesFor(entityType: "product" | "collection" | "image") {
  return entityType === "collection"
    ? (["read_content"] as const)
    : (["read_products"] as const);
}

export const POST = withRouteAuth(
  "company",
  async (_request: NextRequest, { companyId }, context: RouteContext) => {
    const request = _request as Pick<Request, "json"> & NextRequest;

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

      const parsedBody = AiSeoPostSchema.safeParse(bodyResult.data);
      if (!parsedBody.success) {
        return validationError(
          "Invalid request body",
          parsedBody.error.flatten(),
        );
      }

      const body = parsedBody.data;
      const connectionStore =
        createSupabaseShoplineConnectionStore(adminClient);
      const grantedScopes = await getGrantedScopes(connectionStore, {
        companyId,
        websiteId,
      });
      const scopeCheck = checkShoplineScope(
        requiredScopesFor(body.entityType),
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
      const shop = await client.getShop();

      const generatorInput =
        body.entityType === "collection"
          ? {
              entityType: body.entityType,
              entity: collectionToEntity(
                await client.getCollection(body.entityId),
              ),
              shop: { name: shop.name },
              fields: body.fields,
            }
          : body.entityType === "image"
            ? buildImageInput(
                await client.getProduct(body.productId as string),
                body.entityId,
                shop.name,
                body.fields,
              )
            : {
                entityType: body.entityType,
                entity: productToEntity(await client.getProduct(body.entityId)),
                shop: { name: shop.name },
                fields: body.fields,
              };

      const output = await generateShoplineSeoDraft(generatorInput, {
        callModel: callShoplineAiSeoModel,
      });

      return NextResponse.json(output);
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

      if (
        error instanceof Error &&
        error.message === "shopline_image_not_found"
      ) {
        return NextResponse.json(
          { error: "shopline_image_not_found" },
          { status: 404 },
        );
      }

      return handleApiError(error);
    }
  },
);

function productToEntity(product: ShoplineProduct) {
  return {
    title: product.title,
    handle: product.handle,
    type: product.product_type,
    vendor: product.vendor,
    tags: product.tags,
    description: product.seo?.description,
  };
}

function collectionToEntity(collection: {
  title: string;
  handle?: string;
  body_html?: string;
  seo?: { description?: string };
}) {
  return {
    title: collection.title,
    handle: collection.handle,
    description: collection.seo?.description || collection.body_html,
  };
}

function buildImageInput(
  product: ShoplineProduct,
  imageId: string,
  shopName: string,
  fields: Array<"seoTitle" | "seoDescription" | "alt">,
) {
  const image = product.images.find((candidate) => candidate.id === imageId);
  if (!image) {
    throw new Error("shopline_image_not_found");
  }

  return {
    entityType: "image" as const,
    entity: {
      ...productToEntity(product),
      position: image.position,
    },
    shop: { name: shopName },
    fields,
  };
}
