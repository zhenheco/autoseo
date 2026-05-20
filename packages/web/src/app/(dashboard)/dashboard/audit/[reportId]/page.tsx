import { getUser, getUserCompanies } from "@shared/auth";
import { createAdminClient, createClient } from "@shared/supabase";
import { notFound, redirect } from "next/navigation";
import type { Database } from "@/types/database.types";
import {
  AuditReportDetail,
  type AuditIssueItem,
  type AuditReportDetailModel,
} from "./AuditReportDetail";

export const dynamic = "force-dynamic";

type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type AuditIssueRow = Database["public"]["Tables"]["audit_issues"]["Row"];
type ArticleJobRow = Pick<
  Database["public"]["Tables"]["article_jobs"]["Row"],
  "id" | "audit_issue_id"
>;

interface AuditDetailPageProps {
  params: Promise<{ reportId: string }>;
}

export default async function AuditDetailPage({
  params,
}: AuditDetailPageProps) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const { reportId } = await params;
  const supabase = await createClient();
  const { data: report, error } = await supabase
    .from("audit_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw error;
  if (!report) notFound();

  const memberships = await getUserCompanies(user.id);
  const allowedCompanyIds = new Set(
    memberships
      .map((membership) => membership.companies?.id)
      .filter((id): id is string => typeof id === "string"),
  );
  const reportCompanyId = (report as AuditReportRow).company_id;
  if (!reportCompanyId || !allowedCompanyIds.has(reportCompanyId)) {
    redirect("/dashboard/unauthorized");
  }

  const { data: issues, error: issuesError } = await supabase
    .from("audit_issues")
    .select("*")
    .eq("report_id", reportId)
    .order("created_at", { ascending: true });

  if (issuesError) throw issuesError;
  const articleJobsByIssueId = await loadArticleJobsByIssueId(
    supabase,
    ((issues ?? []) as AuditIssueRow[]).map((issue) => issue.id),
  );
  const isShoplineReport = await isShoplineAuditReport(
    report as AuditReportRow,
  );

  return (
    <AuditReportDetail
      report={toDetailModel(
        report as AuditReportRow,
        (issues ?? []) as AuditIssueRow[],
        isShoplineReport,
        articleJobsByIssueId,
      )}
    />
  );
}

function toDetailModel(
  report: AuditReportRow,
  issues: AuditIssueRow[],
  isShoplineReport: boolean,
  articleJobsByIssueId: Map<string, ArticleJobRow>,
): AuditReportDetailModel {
  return {
    id: report.id,
    url: report.url,
    scannedAt: report.scanned_at,
    healthScore: report.health_score,
    pagesScanned: report.pages_scanned,
    source: report.source,
    issues: issues.map<AuditIssueItem>((issue) => ({
      id: issue.id,
      ruleId: issue.rule_id,
      severity: issue.severity,
      riskLevel: issue.risk_level,
      page: issue.page,
      current: issue.current,
      suggested: issue.suggested,
      selector: issue.selector,
      status: issue.status,
      articleJobId: articleJobsByIssueId.get(issue.id)?.id ?? null,
      autoApplyAvailable:
        isShoplineReport &&
        issue.risk_level === "low" &&
        issue.status === "open",
    })),
  };
}

async function loadArticleJobsByIssueId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  issueIds: string[],
): Promise<Map<string, ArticleJobRow>> {
  if (issueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("article_jobs")
    .select("id, audit_issue_id")
    .in("audit_issue_id", issueIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as ArticleJobRow[])
      .filter((job) => job.audit_issue_id)
      .map((job) => [job.audit_issue_id as string, job]),
  );
}

async function isShoplineAuditReport(report: AuditReportRow): Promise<boolean> {
  if (!report.website_id || !report.company_id) return false;

  try {
    const admin = createAdminClient();
    const { data: website, error: websiteError } = await admin
      .from("website_configs")
      .select("id, wordpress_url")
      .eq("id", report.website_id)
      .eq("company_id", report.company_id)
      .maybeSingle();

    if (websiteError) throw websiteError;

    const wordpressUrl =
      typeof website?.wordpress_url === "string" ? website.wordpress_url : "";
    if (wordpressUrl.includes("myshopline.com")) return true;

    const { data: connection, error: connectionError } = await admin
      .from("shopline_connections")
      .select("id")
      .eq("website_id", report.website_id)
      .eq("company_id", report.company_id)
      .eq("status", "active")
      .maybeSingle();

    if (connectionError) throw connectionError;
    return Boolean(connection);
  } catch (error) {
    console.error("[Audit] Failed to resolve SHOPLINE target:", error);
    return false;
  }
}
