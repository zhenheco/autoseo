"use server";

import { getUser, getUserCompanies } from "@shared/auth";
import { createClient } from "@shared/supabase";
import { applyAuditIssueToShopline } from "@/lib/audit/shopline-apply";
import type { Database } from "@/types/database.types";

type ActionResult = { ok: boolean; error?: string };
type AuditIssueRow = Database["public"]["Tables"]["audit_issues"]["Row"];
type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ReviewContext =
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
      supabase: SupabaseClient;
      issue: AuditIssueRow;
      report: AuditReportRow & { company_id: string };
    }
  | { ok: false; error: string };

export async function approveAuditIssue(
  formData: FormData,
): Promise<ActionResult> {
  const issueId = readRequiredString(formData, "issueId");
  if (!issueId) return { ok: false, error: "issue_id_required" };

  const context = await loadReviewContext(issueId);
  if (!context.ok) return context;

  if (context.issue.risk_level !== "medium") {
    return { ok: false, error: "not_eligible" };
  }

  if (
    context.issue.status !== "open" &&
    context.issue.status !== "pending-review"
  ) {
    return { ok: false, error: "not_reviewable" };
  }

  return applyAuditIssueToShopline({
    issue: context.issue,
    report: context.report,
    companyId: context.report.company_id,
    userId: context.user.id,
    supabase: context.supabase,
    preferSuggested: true,
  });
}

export async function rejectAuditIssue(
  formData: FormData,
): Promise<ActionResult> {
  const issueId = readRequiredString(formData, "issueId");
  if (!issueId) return { ok: false, error: "issue_id_required" };

  const context = await loadReviewContext(issueId);
  if (!context.ok) return context;

  const { error } = await context.supabase
    .from("audit_issues")
    .update({ status: "manual" })
    .eq("id", context.issue.id);

  if (error) throw error;
  return { ok: true };
}

export async function editAndApplyAuditIssue(
  _formData: FormData,
): Promise<ActionResult> {
  return { ok: false, error: "not_implemented" };
}

export async function bulkApproveAuditIssues(_formData: FormData): Promise<{
  ok: boolean;
  results: Array<{ issueId: string; ok: boolean; error?: string }>;
}> {
  return { ok: false, results: [] };
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function loadReviewContext(issueId: string): Promise<ReviewContext> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const supabase = await createClient();
  const issue = await loadIssue(supabase, issueId);
  if (!issue) return { ok: false, error: "issue_not_found" };

  const report = await loadReport(supabase, issue.report_id);
  if (!report) return { ok: false, error: "report_not_found" };

  const allowedCompanyIds = await loadAllowedCompanyIds(user.id);
  if (!report.company_id || !allowedCompanyIds.has(report.company_id)) {
    return { ok: false, error: "forbidden" };
  }

  return {
    ok: true,
    user,
    supabase,
    issue,
    report: report as AuditReportRow & { company_id: string },
  };
}

async function loadAllowedCompanyIds(userId: string): Promise<Set<string>> {
  const memberships = await getUserCompanies(userId);
  return new Set(
    memberships
      .map((membership) => membership.companies?.id)
      .filter((id): id is string => typeof id === "string"),
  );
}

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
