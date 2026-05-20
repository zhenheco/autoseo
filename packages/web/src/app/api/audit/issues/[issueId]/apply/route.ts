import {
  applyAuditFixToShopline,
  type ApplyShoplineFixDeps,
  type ApplyShoplineFixInput,
  type ApplyShoplineFixResult,
  type AuditIssue,
} from "@audit";
import { NextResponse } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import { handleApiError } from "@/lib/api/response-helpers";
import { APIRouter } from "@/lib/ai/api-router";
import { detectAIProvider } from "@/lib/ai/fallback-policy";
import { generateShoplineSeoDraft } from "@/lib/shopline/ai-seo-generator";
import { fetchShoplineCollections } from "@/lib/shopline/collection-fetcher";
import { updateShoplineCollectionSeo } from "@/lib/shopline/collection-seo-updater";
import {
  createSupabaseShoplineConnectionStore,
  type ShoplineConnectionStore,
} from "@/lib/shopline/connections";
import { updateShoplineImageAlt } from "@/lib/shopline/image-alt-updater";
import { fetchShoplineProducts } from "@/lib/shopline/product-fetcher";
import { updateShoplineProductSeo } from "@/lib/shopline/seo-updater";
import type { ShoplineCollection, ShoplineProduct } from "@/lib/shopline/types";
import type { Database } from "@/types/database.types";
import { DEFAULT_FALLBACK_CHAINS } from "@/types/ai-models";
import { createAdminClient } from "@shared/supabase";

type RouteContext = {
  params: Promise<{ issueId: string }>;
};

type AuditIssueRow = Database["public"]["Tables"]["audit_issues"]["Row"];
type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type WebsiteConfigRow = Database["public"]["Tables"]["website_configs"]["Row"];
type SupabaseClient = Parameters<
  Parameters<typeof withCompany>[0]
>[1]["supabase"];

export const POST = withCompany(
  async (_request, { supabase, companyId, user }, route: RouteContext) => {
    try {
      const { issueId } = await route.params;
      const issue = await loadIssue(supabase, issueId);
      if (!issue) {
        return NextResponse.json(
          { ok: false, error: "issue_not_found" },
          { status: 404 },
        );
      }

      const report = await loadReport(supabase, issue.report_id);
      if (!report) {
        return NextResponse.json(
          { ok: false, error: "report_not_found" },
          { status: 404 },
        );
      }

      if (report.company_id !== companyId) {
        return NextResponse.json(
          { ok: false, error: "forbidden" },
          { status: 403 },
        );
      }

      if (issue.risk_level !== "low") {
        return NextResponse.json(
          { ok: false, error: "not_eligible" },
          { status: 400 },
        );
      }

      const shoplineTarget = await resolveShoplineTarget(supabase, {
        companyId,
        websiteId: report.website_id,
      });
      if (!shoplineTarget) {
        return NextResponse.json(
          { ok: false, error: "route_not_available" },
          { status: 400 },
        );
      }

      const result = await applyAuditFixToShopline(
        {
          issue: toAuditIssue(issue),
          reportId: report.id,
          shopHandle: shoplineTarget.shopHandle,
        },
        createApplyDeps({
          companyId,
          websiteId: shoplineTarget.website.id,
          userId: user.id,
          supabase,
        }),
      );

      await persistFixLog(supabase, {
        issueId: issue.id,
        userId: user.id,
        result,
      });

      if (result.ok) {
        await markIssueAutoApplied(supabase, issue.id);
      }

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error ?? "fix_failed" },
          { status: 200 },
        );
      }

      return NextResponse.json({
        ok: true,
        route: result.route,
        before: result.before,
        after: result.after,
      });
    } catch (error) {
      return handleApiError(error);
    }
  },
);

async function loadIssue(
  supabase: SupabaseClient,
  issueId: string,
): Promise<AuditIssueRow | null> {
  const { data, error } = await supabase
    .from("audit_issues")
    .select("*")
    .eq("id", issueId)
    .maybeSingle();

  if (error) throw error;
  return (data as AuditIssueRow | null) ?? null;
}

async function resolveShoplineTarget(
  supabase: SupabaseClient,
  input: { companyId: string; websiteId: string | null },
): Promise<{ website: WebsiteConfigRow; shopHandle: string } | null> {
  if (!input.websiteId) return null;

  const website = await loadWebsite(supabase, input.websiteId);
  if (!website || website.company_id !== input.companyId) return null;

  const connection = await loadActiveShoplineConnection(supabase, {
    companyId: input.companyId,
    websiteId: input.websiteId,
  });
  const shopHandle =
    connection?.shop_handle ?? shopHandleFromUrl(website.wordpress_url);

  if (!shopHandle) return null;

  return { website, shopHandle };
}

async function loadWebsite(
  supabase: SupabaseClient,
  websiteId: string,
): Promise<WebsiteConfigRow | null> {
  const { data, error } = await supabase
    .from("website_configs")
    .select("*")
    .eq("id", websiteId)
    .maybeSingle();

  if (error) throw error;
  return (data as WebsiteConfigRow | null) ?? null;
}

async function loadActiveShoplineConnection(
  supabase: SupabaseClient,
  input: { companyId: string; websiteId: string },
): Promise<{ shop_handle: string } | null> {
  const { data, error } = await supabase
    .from("shopline_connections")
    .select("shop_handle")
    .eq("company_id", input.companyId)
    .eq("website_id", input.websiteId)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return (data as { shop_handle: string } | null) ?? null;
}

function shopHandleFromUrl(value: string): string | null {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (!hostname.endsWith(".myshopline.com")) return null;
    return hostname.slice(0, -".myshopline.com".length);
  } catch {
    return null;
  }
}

async function loadReport(
  supabase: SupabaseClient,
  reportId: string,
): Promise<AuditReportRow | null> {
  const { data, error } = await supabase
    .from("audit_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw error;
  return (data as AuditReportRow | null) ?? null;
}

function toAuditIssue(issue: AuditIssueRow): AuditIssue {
  return {
    ruleId: issue.rule_id,
    severity: issue.severity,
    riskLevel: issue.risk_level,
    page: issue.page,
    selector: issue.selector ?? undefined,
    current: issue.current,
    suggested: issue.suggested ?? undefined,
    source: issue.source,
    estimatedImpact: issue.estimated_impact,
  };
}

function createApplyDeps(input: {
  companyId: string;
  websiteId: string;
  userId: string;
  supabase: SupabaseClient;
}): ApplyShoplineFixDeps {
  return {
    shoplineUpdate: (fixInput) => applyShoplineUpdate(fixInput, input),
    generateMetaDescription: async ({ current, pageUrl }) => {
      const output = await generateShoplineSeoDraft(
        {
          entityType: "product",
          entity: {
            title: pageUrl,
            description: current,
          },
          fields: ["seoDescription"],
        },
        { callModel: callAuditAutoModel },
      );

      if (!output.drafts.seoDescription) {
        throw new Error("audit_auto_meta_description_empty");
      }

      return output.drafts.seoDescription;
    },
    generateImageAlt: async ({ imageUrl }) => {
      const output = await generateShoplineSeoDraft(
        {
          entityType: "image",
          entity: {
            title: imageUrl,
          },
          fields: ["alt"],
        },
        { callModel: callAuditAutoModel },
      );

      if (!output.drafts.alt) {
        throw new Error("audit_auto_image_alt_empty");
      }

      return output.drafts.alt;
    },
    getShopHandleForReport: async () => null,
  };
}

async function callAuditAutoModel(
  prompt: string,
  opts?: { taskType?: "simple" | "complex" },
): Promise<{ text: string; model: string }> {
  const taskType = opts?.taskType ?? "simple";
  const model = DEFAULT_FALLBACK_CHAINS[taskType][0];
  if (!model) throw new Error("audit_auto_model_not_configured");

  const router = new APIRouter();
  const response = await router.complete({
    model,
    apiProvider: detectAIProvider(model),
    prompt: ["Source: audit-auto", prompt].join("\n\n"),
    temperature: 0.3,
    maxTokens: 400,
    responseFormat: "json",
  });

  return { text: response.content, model: response.model };
}

async function applyShoplineUpdate(
  input: ApplyShoplineFixInput,
  context: {
    companyId: string;
    websiteId: string;
    userId: string;
    supabase: SupabaseClient;
  },
): ReturnType<ApplyShoplineFixDeps["shoplineUpdate"]> {
  const suggested = input.issue.suggested?.trim();
  if (!suggested) throw new Error("audit_fix_suggestion_missing");

  const adminClient = createAdminClient();
  const store = createSupabaseShoplineConnectionStore(adminClient);

  if (input.issue.ruleId === "alt.missing") {
    return applyImageAltUpdate(input, context, store, suggested);
  }

  if (input.issue.ruleId === "og.image.missing") {
    return applyOgImageFallback(input, context, store, suggested);
  }

  const target = inferShoplinePageTarget(input.issue.page);
  if (!target) throw new Error("shopline_target_not_found");

  if (target.type === "collection") {
    const collection = await findCollectionByHandle(
      context.companyId,
      context.websiteId,
      store,
      target.handle,
    );
    if (!collection) throw new Error("shopline_target_not_found");

    const updated = await updateShoplineCollectionSeo(
      context.companyId,
      context.websiteId,
      collection.id,
      { seo: { description: suggested } },
      {
        store,
        before: collection,
        auditOptions: {
          supabase: context.supabase,
          userId: context.userId,
          source: "ai",
          model: "audit-auto",
        },
      },
    );

    return {
      collectionId: collection.id,
      seo: updated.seo,
    };
  }

  const product = await findProductByHandle(
    context.companyId,
    context.websiteId,
    store,
    target.handle,
  );
  if (!product) throw new Error("shopline_target_not_found");

  const updated = await updateShoplineProductSeo(
    context.companyId,
    context.websiteId,
    product.id,
    { seo: { description: suggested }, source: "ai" },
    {
      store,
      auditOptions: {
        supabase: context.supabase,
        userId: context.userId,
        source: "ai",
        model: "audit-auto",
      },
    },
  );

  return {
    productId: product.id,
    seo: updated.seo,
  };
}

async function applyImageAltUpdate(
  input: ApplyShoplineFixInput,
  context: {
    companyId: string;
    websiteId: string;
    userId: string;
    supabase: SupabaseClient;
  },
  store: ShoplineConnectionStore,
  alt: string,
): ReturnType<ApplyShoplineFixDeps["shoplineUpdate"]> {
  const target = inferShoplinePageTarget(input.issue.page);
  if (!target || target.type !== "product") {
    throw new Error("shopline_target_not_found");
  }

  const product = await findProductByHandle(
    context.companyId,
    context.websiteId,
    store,
    target.handle,
  );
  if (!product) throw new Error("shopline_target_not_found");

  const image = findProductImage(product, resolveImageUrl(input.issue));
  if (!image) throw new Error("shopline_image_not_found");

  const updated = await updateShoplineImageAlt(
    context.companyId,
    context.websiteId,
    product.id,
    image.id,
    alt,
    {
      store,
      before: { alt: image.alt ?? null },
      auditOptions: {
        supabase: context.supabase,
        userId: context.userId,
        source: "ai",
        model: "audit-auto",
      },
    },
  );

  return {
    productId: product.id,
    image: { id: updated.id, alt: updated.alt ?? alt },
  };
}

async function applyOgImageFallback(
  input: ApplyShoplineFixInput,
  context: { companyId: string; websiteId: string },
  store: ShoplineConnectionStore,
  imageUrl: string,
): ReturnType<ApplyShoplineFixDeps["shoplineUpdate"]> {
  const target = inferShoplinePageTarget(input.issue.page);
  if (!target) {
    return { image: { id: "og-image-fallback", alt: imageUrl } };
  }

  if (target.type === "collection") {
    const collection = await findCollectionByHandle(
      context.companyId,
      context.websiteId,
      store,
      target.handle,
    );
    if (!collection) throw new Error("shopline_target_not_found");
    return {
      collectionId: collection.id,
      image: {
        id: collection.image?.id ?? "collection-image",
        alt: imageUrl,
      },
    };
  }

  const product = await findProductByHandle(
    context.companyId,
    context.websiteId,
    store,
    target.handle,
  );
  if (!product) throw new Error("shopline_target_not_found");

  return {
    productId: product.id,
    image: {
      id: product.images[0]?.id ?? "product-image",
      alt: imageUrl,
    },
  };
}

async function findProductByHandle(
  companyId: string,
  websiteId: string,
  store: ShoplineConnectionStore,
  handle: string,
): Promise<ShoplineProduct | null> {
  const { products } = await fetchShoplineProducts(
    companyId,
    websiteId,
    undefined,
    {
      store,
    },
  );

  return (
    products.find(
      (product) => product.handle === handle || product.id === handle,
    ) ?? null
  );
}

async function findCollectionByHandle(
  companyId: string,
  websiteId: string,
  store: ShoplineConnectionStore,
  handle: string,
): Promise<ShoplineCollection | null> {
  const { collections } = await fetchShoplineCollections(
    companyId,
    websiteId,
    null,
    { store },
  );

  return (
    collections.find(
      (collection) => collection.handle === handle || collection.id === handle,
    ) ?? null
  );
}

function inferShoplinePageTarget(
  pageUrl: string,
): { type: "product" | "collection"; handle: string } | null {
  try {
    const segments = new URL(pageUrl).pathname.split("/").filter(Boolean);
    const productsIndex = segments.indexOf("products");
    if (productsIndex >= 0 && segments[productsIndex + 1]) {
      return { type: "product", handle: segments[productsIndex + 1] };
    }

    const collectionsIndex = segments.indexOf("collections");
    if (collectionsIndex >= 0 && segments[collectionsIndex + 1]) {
      return { type: "collection", handle: segments[collectionsIndex + 1] };
    }

    return null;
  } catch {
    return null;
  }
}

function resolveImageUrl(issue: AuditIssue): string {
  const selectorSrc = issue.selector?.match(/img\[src="([^"]+)"\]/)?.[1];
  const candidate = selectorSrc ?? issue.current;
  if (!candidate) return "";

  try {
    return new URL(candidate, issue.page).href;
  } catch {
    return candidate;
  }
}

function findProductImage(product: ShoplineProduct, imageUrl: string) {
  if (!imageUrl) return product.images[0] ?? null;

  let imagePath = "";
  try {
    imagePath = new URL(imageUrl).pathname;
  } catch {
    imagePath = imageUrl;
  }

  return (
    product.images.find((image) => {
      if (image.src === imageUrl) return true;
      try {
        return new URL(image.src).pathname === imagePath;
      } catch {
        return image.src.includes(imagePath);
      }
    }) ??
    product.images[0] ??
    null
  );
}

async function persistFixLog(
  supabase: SupabaseClient,
  input: {
    issueId: string;
    userId: string;
    result: ApplyShoplineFixResult;
  },
) {
  const { error } = await supabase.from("audit_fix_log").insert({
    issue_id: input.issueId,
    applied_by: input.userId,
    route: input.result.route,
    before: input.result.before,
    after: input.result.after,
    result: input.result.ok ? "success" : "failed",
    error_message: input.result.error ?? null,
  });

  if (error) throw error;
}

async function markIssueAutoApplied(supabase: SupabaseClient, issueId: string) {
  const { error } = await supabase
    .from("audit_issues")
    .update({ status: "auto-applied" })
    .eq("id", issueId);

  if (error) throw error;
}
