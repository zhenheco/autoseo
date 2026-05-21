#!/usr/bin/env tsx

import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { captureAutomationCronRun } from "../../src/lib/analytics/posthog-server";
import {
  createAutomationScheduler,
  type AutomationScheduler,
} from "../../src/lib/automation/scheduler";
import { sendAutomationQuotaWarningEmail } from "../../src/lib/email/cf-email-client";
import { createQuotaEnforcer } from "../../src/lib/quota/enforcer";
import { resolveQuotaPlan } from "../../src/lib/quota/plan-resolver";
import {
  AiGatewayLLMSynthesizer,
  createTrendsAggregator,
  HttpGoogleTrendsRssClient,
  HttpGSCClient,
  HttpPerplexityClient,
} from "../../src/lib/trends";
import type { Database } from "../../src/types/database.types";

type SchedulerBrandResult = Awaited<
  ReturnType<AutomationScheduler["tickAllBrands"]>
>[number];

type Logger = Pick<typeof console, "error" | "log" | "warn">;

type BrandOwnerEmailTarget = {
  brandId: string;
  brandName: string;
  companyId: string;
  ownerEmail: string;
};

type AutoGenerateArticlesDeps = {
  scheduler: Pick<AutomationScheduler, "tickAllBrands">;
  resolveBrandOwnerEmail(
    brandId: string,
  ): Promise<BrandOwnerEmailTarget | null>;
  sendQuotaWarningEmail(input: {
    brandId: string;
    brandName: string;
    companyId: string;
    ownerEmail: string;
    runDate: string;
  }): Promise<{ ok: boolean; error?: string }>;
  captureCronRun(properties: {
    count: number;
    brandsProcessed: number;
    quotaExceeded: number;
  }): void | Promise<void>;
  setOutput(name: string, value: string): void;
  logger?: Logger;
  now?: () => Date;
};

export type AutoGenerateArticlesRunResult = {
  brands: SchedulerBrandResult[];
  totals: {
    created: number;
    brandsProcessed: number;
    quotaExceeded: number;
  };
};

type RuntimeEnv = {
  supabaseUrl: string;
  supabaseDbUrl: string | null;
  supabaseServiceRoleKey: string;
  aiGatewayEnabled: boolean;
  aiGatewayAccountId: string | null;
  aiGatewayId: string | null;
  aiGatewayToken: string | null;
};

type SupabaseAdminClient = SupabaseClient<Database>;

function readRuntimeEnv(env: NodeJS.ProcessEnv): RuntimeEnv {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return {
    supabaseUrl,
    supabaseDbUrl: env.SUPABASE_DB_URL || null,
    supabaseServiceRoleKey,
    aiGatewayEnabled:
      env.CF_AI_GATEWAY_ENABLED === "true" || env.AI_GATEWAY_ENABLED === "true",
    aiGatewayAccountId:
      env.CF_AI_GATEWAY_ACCOUNT_ID || env.AI_GATEWAY_ACCOUNT_ID || null,
    aiGatewayId: env.CF_AI_GATEWAY_ID || env.AI_GATEWAY_ID || null,
    aiGatewayToken: env.CF_AI_GATEWAY_TOKEN || env.AI_GATEWAY_TOKEN || null,
  };
}

export async function runAutoGenerateArticles(
  deps: AutoGenerateArticlesDeps,
): Promise<AutoGenerateArticlesRunResult> {
  const logger = deps.logger ?? console;
  const now = deps.now ?? (() => new Date());
  const runDate = now().toISOString().slice(0, 10);

  const brands = await deps.scheduler.tickAllBrands();

  for (const brand of brands) {
    logger.log(formatBrandResult(brand));

    if (brand.reason === "quota_exceeded") {
      await warnBrandOwnerAboutQuota({
        brandId: brand.brandId,
        runDate,
        deps,
        logger,
      });
    }
  }

  const totals = {
    created: brands.reduce((sum, brand) => sum + brand.created, 0),
    brandsProcessed: brands.length,
    quotaExceeded: brands.filter((brand) => brand.reason === "quota_exceeded")
      .length,
  };

  await deps.captureCronRun({
    count: totals.created,
    brandsProcessed: totals.brandsProcessed,
    quotaExceeded: totals.quotaExceeded,
  });

  deps.setOutput("count", String(totals.created));
  deps.setOutput("brands_processed", String(totals.brandsProcessed));
  deps.setOutput("quota_exceeded", String(totals.quotaExceeded));

  logger.log("[Auto Generate Articles] Complete", totals);

  return { brands, totals };
}

function formatBrandResult(brand: SchedulerBrandResult): string {
  return [
    `[Auto Generate Articles] brand=${brand.brandId}`,
    `created=${brand.created}`,
    brand.reason ? `reason=${brand.reason}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

async function warnBrandOwnerAboutQuota(input: {
  brandId: string;
  runDate: string;
  deps: AutoGenerateArticlesDeps;
  logger: Logger;
}): Promise<void> {
  try {
    const target = await input.deps.resolveBrandOwnerEmail(input.brandId);
    if (!target) {
      input.logger.warn(
        `[Auto Generate Articles] brand=${input.brandId} quota_exceeded owner_email=missing`,
      );
      return;
    }

    const result = await input.deps.sendQuotaWarningEmail({
      brandId: target.brandId,
      brandName: target.brandName,
      companyId: target.companyId,
      ownerEmail: target.ownerEmail,
      runDate: input.runDate,
    });

    if (!result.ok) {
      input.logger.warn(
        `[Auto Generate Articles] brand=${input.brandId} quota_warning_email=failed error=${result.error ?? "unknown"}`,
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    input.logger.warn(
      `[Auto Generate Articles] brand=${input.brandId} quota_warning_email=failed error=${message}`,
    );
  }
}

function createProductionDeps(
  env: NodeJS.ProcessEnv = process.env,
): AutoGenerateArticlesDeps {
  const runtimeEnv = readRuntimeEnv(env);
  const supabase = createClient<Database>(
    runtimeEnv.supabaseUrl,
    runtimeEnv.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const scheduler = createAutomationScheduler({
    supabase: supabase as never,
    quotaEnforcer: createQuotaEnforcer({
      supabase: supabase as never,
      resolvePlan: (companyId) =>
        resolveQuotaPlan(supabase as never, companyId),
    }),
    trendsAggregator: createProductionTrendsAggregator(runtimeEnv, env),
  });

  return {
    scheduler,
    resolveBrandOwnerEmail: (brandId) =>
      resolveBrandOwnerEmail(supabase, brandId),
    sendQuotaWarningEmail: (input) =>
      sendAutomationQuotaWarningEmail({
        to: input.ownerEmail,
        brandName: input.brandName,
        runDate: input.runDate,
        idempotencyKey: `auto-generate-articles:quota:${input.brandId}:${input.runDate}`,
      }),
    captureCronRun: (properties) => captureAutomationCronRun(properties),
    setOutput: writeGitHubActionOutput,
  };
}

function createProductionTrendsAggregator(
  runtimeEnv: RuntimeEnv,
  env: NodeJS.ProcessEnv,
) {
  const cfAigToken = runtimeEnv.aiGatewayToken || undefined;
  const perplexityEndpoint =
    getGatewayBaseUrl("perplexity-ai", runtimeEnv) ||
    env.PERPLEXITY_API_BASE_URL ||
    "https://api.perplexity.ai";
  const geminiEndpoint =
    getGatewayBaseUrl("google-ai-studio", runtimeEnv) ||
    env.GEMINI_API_BASE_URL ||
    "https://generativelanguage.googleapis.com";
  const gscToken =
    env.GSC_ACCESS_TOKEN || env.GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN || "";

  return createTrendsAggregator({
    perplexityClient: new HttpPerplexityClient({
      apiKey: env.PERPLEXITY_API_KEY || "",
      endpoint: perplexityEndpoint,
      cfAigToken,
      model: env.PERPLEXITY_MODEL || "sonar",
    }),
    gscClient: gscToken
      ? new HttpGSCClient({
          apiKey: gscToken,
          endpoint:
            env.GSC_API_BASE_URL || "https://www.googleapis.com/webmasters/v3",
        })
      : null,
    googleTrendsClient: new HttpGoogleTrendsRssClient({
      endpoint:
        env.GOOGLE_TRENDS_RSS_URL ||
        "https://trends.google.com/trending/rss?geo=US",
      geo: env.GOOGLE_TRENDS_GEO,
    }),
    llmSynthesizer: new AiGatewayLLMSynthesizer({
      apiKey: env.GEMINI_API_KEY || "",
      endpoint: geminiEndpoint,
      cfAigToken,
      model: env.TRENDS_LLM_MODEL || "gemini-2.0-flash",
    }),
  });
}

function getGatewayBaseUrl(
  provider: "google-ai-studio" | "perplexity-ai",
  env: RuntimeEnv,
) {
  if (!env.aiGatewayEnabled || !env.aiGatewayAccountId || !env.aiGatewayId) {
    return null;
  }

  return `https://gateway.ai.cloudflare.com/v1/${env.aiGatewayAccountId}/${env.aiGatewayId}/${provider}`;
}

async function resolveBrandOwnerEmail(
  supabase: SupabaseAdminClient,
  brandId: string,
): Promise<BrandOwnerEmailTarget | null> {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, name, company_id")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    throw new Error(brandError.message || "automation_brand_lookup_failed");
  }
  if (!brand?.company_id) return null;

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id, owner_id")
    .eq("id", brand.company_id)
    .maybeSingle();

  if (companyError) {
    throw new Error(companyError.message || "automation_company_lookup_failed");
  }
  if (!company?.owner_id) return null;

  const { data: userData, error: userError } =
    await supabase.auth.admin.getUserById(company.owner_id);

  if (userError) {
    throw new Error(userError.message || "automation_owner_lookup_failed");
  }

  const ownerEmail = userData.user?.email;
  if (!ownerEmail) return null;

  return {
    brandId: brand.id,
    brandName: brand.name,
    companyId: company.id,
    ownerEmail,
  };
}

function writeGitHubActionOutput(name: string, value: string): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;

  appendFileSync(outputPath, `${name}=${value}\n`, "utf8");
}

async function main() {
  await runAutoGenerateArticles(createProductionDeps());
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error("[Auto Generate Articles] Fatal error", error);
    process.exitCode = 1;
  });
}
