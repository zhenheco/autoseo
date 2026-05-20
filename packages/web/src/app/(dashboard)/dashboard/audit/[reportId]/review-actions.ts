"use server";

import { getUser, getUserCompanies } from "@shared/auth";
import { createClient } from "@shared/supabase";
import { applyAuditIssueToShopline } from "@/lib/audit/shopline-apply";
import type { Database } from "@/types/database.types";

type ActionResult = { ok: boolean; error?: string };
type AuditIssueRow = Database["public"]["Tables"]["audit_issues"]["Row"];
type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function approveAuditIssue(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "unauthorized" };

  const issueId = readRequiredString(formData, "issueId");
  if (!issueId) return { ok: false, error: "issue_id_required" };

  const supabase = await createClient();
  const issue = await loadIssue(supabase, issueId);
  if (!issue) return { ok: false, error: "issue_not_found" };

  const report = await loadReport(supabase, issue.report_id);
  if (!report) return { ok: false, error: "report_not_found" };

  const allowedCompanyIds = await loadAllowedCompanyIds(user.id);
  if (!report.company_id || !allowedCompanyIds.has(report.company_id)) {
    return { ok: false, error: "forbidden" };
  }

  if (issue.risk_level !== "medium") {
    return { ok: false, error: "not_eligible" };
  }

  if (issue.status !== "open" && issue.status !== "pending-review") {
    return { ok: false, error: "not_reviewable" };
  }

  return applyAuditIssueToShopline({
    issue,
    report,
    companyId: report.company_id,
    userId: user.id,
    supabase,
    preferSuggested: true,
  });
}

export async function rejectAuditIssue(
  _formData: FormData,
): Promise<ActionResult> {
  return { ok: false, error: "not_implemented" };
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
