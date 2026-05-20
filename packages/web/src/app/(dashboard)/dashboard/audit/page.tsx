import { getUser, getUserPrimaryCompany } from "@shared/auth";
import { createClient } from "@shared/supabase";
import { redirect } from "next/navigation";
import {
  AuditReportsList,
  type AuditReportListItem,
  type AuditSeverity,
  type AuditWebsiteOption,
} from "./AuditReportsList";
import type { Database } from "@/types/database.types";

export const dynamic = "force-dynamic";

type AuditReportRow = Database["public"]["Tables"]["audit_reports"]["Row"];
type AuditIssueRow = Pick<
  Database["public"]["Tables"]["audit_issues"]["Row"],
  "report_id" | "severity"
>;
type WebsiteRow = Pick<
  Database["public"]["Tables"]["website_configs"]["Row"],
  "id" | "website_name" | "wordpress_url" | "company_id"
>;

const pageSize = 20;

interface AuditPageProps {
  searchParams?: Promise<{ page?: string; website?: string }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const company = await getUserPrimaryCompany(user.id);
  if (!company) {
    redirect("/dashboard/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const selectedWebsiteId = params.website;
  const supabase = await createClient();

  const websites = await loadCompanyWebsites(supabase, company.id);
  const allowedWebsiteIds = new Set(websites.map((website) => website.id));
  const safeSelectedWebsiteId =
    selectedWebsiteId && allowedWebsiteIds.has(selectedWebsiteId)
      ? selectedWebsiteId
      : undefined;

  const reports = await loadAuditReports(supabase, {
    companyId: company.id,
    websiteIds: [...allowedWebsiteIds],
    selectedWebsiteId: safeSelectedWebsiteId,
    page,
  });
  const reportIds = reports.map((report) => report.id);
  const issueCounts = await loadIssueCounts(supabase, reportIds);

  const visibleReports = reports
    .filter(
      (report) =>
        report.company_id === company.id ||
        (report.website_id !== null &&
          allowedWebsiteIds.has(report.website_id)),
    )
    .map<AuditReportListItem>((report) => ({
      id: report.id,
      url: report.url,
      websiteId: report.website_id,
      scannedAt: report.scanned_at,
      healthScore: report.health_score,
      issueCounts: issueCounts.get(report.id) ?? emptyCounts(),
    }));

  const websiteOptions = websites.map<AuditWebsiteOption>((website) => ({
    id: website.id,
    name: website.website_name,
    url: website.wordpress_url,
  }));

  const nextPageHref =
    visibleReports.length === pageSize
      ? buildAuditHref({ page: page + 1, website: safeSelectedWebsiteId })
      : undefined;

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <AuditReportsList
        reports={visibleReports}
        websites={websiteOptions}
        selectedWebsiteId={safeSelectedWebsiteId}
        nextPageHref={nextPageHref}
      />
    </div>
  );
}

async function loadCompanyWebsites(
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string,
): Promise<WebsiteRow[]> {
  const { data, error } = await supabase
    .from("website_configs")
    .select("id, website_name, wordpress_url, company_id")
    .eq("company_id", companyId)
    .order("website_name", { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? (data as WebsiteRow[]) : [];
}

async function loadAuditReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    companyId: string;
    websiteIds: string[];
    selectedWebsiteId?: string;
    page: number;
  },
): Promise<AuditReportRow[]> {
  const from = (input.page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("audit_reports")
    .select("*")
    .order("scanned_at", { ascending: false })
    .range(from, to);

  if (input.selectedWebsiteId) {
    query = query.eq("website_id", input.selectedWebsiteId);
  } else if (input.websiteIds.length > 0) {
    query = query.or(
      `company_id.eq.${input.companyId},website_id.in.(${input.websiteIds.join(",")})`,
    );
  } else {
    query = query.eq("company_id", input.companyId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? (data as AuditReportRow[]) : [];
}

async function loadIssueCounts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  reportIds: string[],
) {
  const counts = new Map<string, Record<AuditSeverity, number>>();
  if (reportIds.length === 0) return counts;

  const { data, error } = await supabase
    .from("audit_issues")
    .select("report_id, severity")
    .in("report_id", reportIds);

  if (error) throw error;
  for (const row of (data ?? []) as AuditIssueRow[]) {
    const current = counts.get(row.report_id) ?? emptyCounts();
    current[row.severity] += 1;
    counts.set(row.report_id, current);
  }
  return counts;
}

function emptyCounts(): Record<AuditSeverity, number> {
  return { critical: 0, warning: 0, info: 0 };
}

function buildAuditHref(input: { page: number; website?: string }) {
  const params = new URLSearchParams({ page: String(input.page) });
  if (input.website) params.set("website", input.website);
  return `/dashboard/audit?${params.toString()}`;
}
