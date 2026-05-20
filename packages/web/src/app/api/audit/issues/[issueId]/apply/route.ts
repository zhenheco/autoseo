import { NextResponse } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import { handleApiError } from "@/lib/api/response-helpers";
import type { Database } from "@/types/database.types";

type RouteContext = {
  params: Promise<{ issueId: string }>;
};

type AuditIssueRow = Database["public"]["Tables"]["audit_issues"]["Row"];
type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type SupabaseClient = Parameters<
  Parameters<typeof withCompany>[0]
>[1]["supabase"];

export const POST = withCompany(
  async (_request, { supabase, companyId }, route: RouteContext) => {
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

      return NextResponse.json(
        { ok: false, error: `not_implemented:${issueId}` },
        { status: 501 },
      );
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
