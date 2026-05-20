import { dispatchAuditIssueToArticleGenerator } from "@audit";
import { NextResponse } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import { handleApiError } from "@/lib/api/response-helpers";
import {
  createAuditArticleDispatchDeps,
  toDispatchableAuditIssue,
  type AuditArticleDispatchSupabaseClient,
  type AuditIssueRowForDispatch,
} from "@/lib/audit/article-dispatch";
import type { Database } from "@/types/database.types";

type RouteContext = {
  params: Promise<{ issueId: string }>;
};

type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type SupabaseClient = Parameters<
  Parameters<typeof withCompany>[0]
>[1]["supabase"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST = withCompany(
  async (_request, { supabase, companyId }, route: RouteContext) => {
    try {
      const { issueId } = await route.params;
      if (!uuidPattern.test(issueId)) {
        return NextResponse.json(
          { ok: false, error: "invalid_issue_id" },
          { status: 400 },
        );
      }

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

      const dispatchSupabase =
        supabase as unknown as AuditArticleDispatchSupabaseClient;

      const result = await dispatchAuditIssueToArticleGenerator(
        {
          issue: toDispatchableAuditIssue(issue),
          companyId,
        },
        createAuditArticleDispatchDeps(dispatchSupabase),
      );

      if (!result.ok) {
        return NextResponse.json(result, {
          status: result.reason === "rule_not_supported" ? 400 : 200,
        });
      }

      return NextResponse.json(result);
    } catch (error) {
      return handleApiError(error);
    }
  },
);

async function loadIssue(
  supabase: SupabaseClient,
  issueId: string,
): Promise<(AuditIssueRowForDispatch & { report_id: string }) | null> {
  const { data, error } = await supabase
    .from("audit_issues")
    .select(
      "id, report_id, rule_id, severity, risk_level, page, selector, current, suggested, source, estimated_impact",
    )
    .eq("id", issueId)
    .maybeSingle();

  if (error) throw error;
  return (
    (data as (AuditIssueRowForDispatch & { report_id: string }) | null) ?? null
  );
}

async function loadReport(
  supabase: SupabaseClient,
  reportId: string,
): Promise<AuditReportRow | null> {
  const { data, error } = await supabase
    .from("audit_reports")
    .select("id, company_id")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw error;
  return (data as AuditReportRow | null) ?? null;
}
