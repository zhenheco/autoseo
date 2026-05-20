import {
  auditWebsite,
  dispatchAuditIssueToArticleGenerator,
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
  type AuditIssueRowForDispatch,
} from "@/lib/audit/article-dispatch";
import type { Json } from "@/types/database.types";

interface AuditRequestBody {
  websiteId?: string;
  url?: string;
  scope?: "single-page";
}

type SupabaseClient = Parameters<
  Parameters<typeof withCompany>[0]
>[1]["supabase"];

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

      const report = await auditWebsite({ url: auditUrl, scope });
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
    const { data: issuesData, error: issuesError } = await supabase
      .from("audit_issues")
      .insert(
        input.report.issues.map((issue) => ({
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

async function dispatchEligibleIssuesToArticleGenerator(
  supabase: SupabaseClient,
  input: { companyId: string; issues: AuditIssueRowForDispatch[] },
) {
  const deps = createAuditArticleDispatchDeps(supabase);

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
