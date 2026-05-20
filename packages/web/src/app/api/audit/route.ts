import {
  auditWebsite,
  dispatchAuditIssueToArticleGenerator,
  runChromiumAudit,
  type AuditReport,
  type AuditScope,
} from "@audit";
import { NextResponse } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import {
  forbidden,
  handleApiError,
  validationError,
} from "@/lib/api/response-helpers";
import {
  createAuditArticleDispatchDeps,
  toDispatchableAuditIssue,
  type AuditArticleDispatchSupabaseClient,
  type AuditIssueRowForDispatch,
} from "@/lib/audit/article-dispatch";
import { createCloudflareBrowserRenderingFetcher } from "@/lib/audit/chromium-fetcher";
import { APIRouter } from "@/lib/ai/api-router";
import { detectAIProvider } from "@/lib/ai/fallback-policy";
import { generateShoplineSeoDraft } from "@/lib/shopline/ai-seo-generator";
import type { Json } from "@/types/database.types";
import { DEFAULT_FALLBACK_CHAINS } from "@/types/ai-models";

interface AuditRequestBody {
  websiteId?: string;
  url?: string;
  scope?: "single-page";
}

type SupabaseClient = Parameters<
  Parameters<typeof withCompany>[0]
>[1]["supabase"];

type PlanTier = "free" | "starter" | "pro" | "business" | "agency";

export const POST = withCompany(
  async (request, { user, supabase, companyId }) => {
    let body: AuditRequestBody;
    try {
      body = (await request.json()) as AuditRequestBody;
    } catch {
      return validationError("Request body must be valid JSON");
    }

    const websiteId = normalizeOptionalString(body.websiteId);
    const directUrl = normalizeOptionalString(body.url);
    const scope = body.scope ?? "single-page";

    if (scope !== "single-page") {
      return validationError("Only single-page audit scope is supported");
    }

    if (!websiteId && !directUrl) {
      return validationError("websiteId or url is required");
    }

    try {
      const website = websiteId
        ? await loadCompanyWebsite(supabase, websiteId, companyId)
        : null;

      if (websiteId && !website) {
        return forbidden("Website does not belong to this company");
      }

      const auditUrl = website?.wordpress_url ?? directUrl;
      if (!auditUrl) {
        return validationError("url is required");
      }

      const planTier = await loadCompanyPlanTier(supabase, companyId);
      const includeChromium = isChromiumAuditEnabledForTier(planTier);
      const report = includeChromium
        ? await auditWebsite(
            { url: auditUrl, scope, includeChromium },
            {
              chromiumAudit: (url) =>
                runChromiumAudit(url, {
                  browserRenderingFetch:
                    createCloudflareBrowserRenderingFetcher(),
                }),
            },
          )
        : await auditWebsite({ url: auditUrl, scope, includeChromium });
      const persisted = await persistAuditReport(supabase, {
        report,
        companyId,
        websiteId: website?.id ?? null,
        userId: user.id,
        scope,
      });
      await dispatchEligibleIssuesToArticleGenerator(supabase, {
        companyId,
        issues: persisted.issues,
      });
      const redirect = `/dashboard/audit/${persisted.reportId}`;

      return NextResponse.json({ reportId: persisted.reportId, redirect });
    } catch (error) {
      return handleApiError(error);
    }
  },
);

async function loadCompanyWebsite(
  supabase: SupabaseClient,
  websiteId: string,
  companyId: string,
) {
  const { data, error } = await supabase
    .from("website_configs")
    .select("id, wordpress_url, company_id")
    .eq("id", websiteId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.company_id !== companyId) return null;
  return data as { id: string; wordpress_url: string; company_id: string };
}

async function loadCompanyPlanTier(
  supabase: SupabaseClient,
  companyId: string,
): Promise<PlanTier> {
  const { data, error } = await supabase
    .from("companies")
    .select("subscription_tier")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;

  const tier = (data as { subscription_tier?: unknown } | null)
    ?.subscription_tier;
  return isPlanTier(tier) ? tier : "free";
}

function isChromiumAuditEnabledForTier(tier: PlanTier): boolean {
  return tier === "pro" || tier === "business" || tier === "agency";
}

function isPlanTier(value: unknown): value is PlanTier {
  return (
    value === "free" ||
    value === "starter" ||
    value === "pro" ||
    value === "business" ||
    value === "agency"
  );
}

async function persistAuditReport(
  supabase: SupabaseClient,
  input: {
    report: AuditReport;
    companyId: string;
    websiteId: string | null;
    userId: string;
    scope: AuditScope;
  },
) {
  const { data, error } = await supabase
    .from("audit_reports")
    .insert({
      company_id: input.companyId,
      website_id: input.websiteId,
      url: input.report.url,
      scope: input.scope,
      health_score: input.report.healthScore,
      pages_scanned: input.report.pagesScanned,
      raw_payload: input.report as unknown as Json,
      source: "dashboard",
      scanned_at: input.report.scannedAt,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `audit_report_persist_failed: ${error?.message ?? "no id"}`,
    );
  }

  let insertedIssues: AuditIssueRowForDispatch[] = [];

  if (input.report.issues.length > 0) {
    const issues = await prepareIssuesForPersist(input.report.issues);
    const { data: issuesData, error: issuesError } = await supabase
      .from("audit_issues")
      .insert(
        issues.map((issue) => ({
          report_id: data.id,
          rule_id: issue.ruleId,
          severity: issue.severity,
          risk_level: issue.riskLevel,
          page: issue.page,
          selector: issue.selector ?? null,
          current: issue.current,
          suggested: issue.suggested ?? null,
          source: issue.source,
          estimated_impact: issue.estimatedImpact,
          status: issue.riskLevel === "medium" ? "pending-review" : "open",
        })),
      )
      .select(
        "id, rule_id, severity, risk_level, page, selector, current, suggested, source, estimated_impact",
      );

    if (issuesError) {
      throw new Error(`audit_issues_persist_failed: ${issuesError.message}`);
    }

    insertedIssues = (issuesData ?? []) as AuditIssueRowForDispatch[];
  }

  return {
    reportId: data.id as string,
    issues: insertedIssues,
  };
}

async function prepareIssuesForPersist(issues: AuditReport["issues"]) {
  return Promise.all(
    issues.map(async (issue) => {
      if (issue.riskLevel !== "medium" || issue.suggested?.trim()) {
        return issue;
      }

      try {
        return {
          ...issue,
          suggested: await generateSuggested(issue),
        };
      } catch (error) {
        console.error("[Audit] Failed to pre-generate review suggestion:", {
          ruleId: issue.ruleId,
          page: issue.page,
          error,
        });
        return issue;
      }
    }),
  );
}

async function generateSuggested(issue: AuditReport["issues"][number]) {
  const field = inferSuggestedField(issue.ruleId);
  const output = await generateShoplineSeoDraft(
    {
      entityType: field === "alt" ? "image" : "product",
      entity: {
        title: issue.page,
        description: issue.current,
      },
      fields: [field],
    },
    { callModel: callAuditReviewModel },
  );

  const suggested = output.drafts[field]?.trim();
  if (!suggested) throw new Error("audit_review_suggestion_empty");
  return suggested;
}

function inferSuggestedField(
  ruleId: string,
): "seoTitle" | "seoDescription" | "alt" {
  if (ruleId.includes("alt")) return "alt";
  if (ruleId.includes("title") || ruleId.includes("h1")) return "seoTitle";
  return "seoDescription";
}

async function callAuditReviewModel(
  prompt: string,
  opts?: { taskType?: "simple" | "complex" },
): Promise<{ text: string; model: string }> {
  const taskType = opts?.taskType ?? "simple";
  const model = DEFAULT_FALLBACK_CHAINS[taskType][0];
  if (!model) throw new Error("audit_review_model_not_configured");

  const router = new APIRouter();
  const response = await router.complete({
    model,
    apiProvider: detectAIProvider(model),
    prompt: ["Source: audit-review-suggested", prompt].join("\n\n"),
    temperature: 0.3,
    maxTokens: 400,
    responseFormat: "json",
  });

  return { text: response.content, model: response.model };
}

async function dispatchEligibleIssuesToArticleGenerator(
  supabase: unknown,
  input: { companyId: string; issues: AuditIssueRowForDispatch[] },
) {
  const deps = createAuditArticleDispatchDeps(
    supabase as AuditArticleDispatchSupabaseClient,
  );

  for (const issue of input.issues) {
    if (issue.risk_level === "low") continue;

    try {
      await dispatchAuditIssueToArticleGenerator(
        {
          issue: toDispatchableAuditIssue(issue),
          companyId: input.companyId,
        },
        deps,
      );
    } catch (error) {
      console.error("[Audit] Failed to dispatch article job:", {
        issueId: issue.id,
        error,
      });
    }
  }
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}
