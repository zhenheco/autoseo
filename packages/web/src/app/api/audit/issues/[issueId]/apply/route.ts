import { NextResponse } from "next/server";
import { withCompany } from "@/lib/api/auth-middleware";
import { handleApiError } from "@/lib/api/response-helpers";
import type { Database } from "@/types/database.types";

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
