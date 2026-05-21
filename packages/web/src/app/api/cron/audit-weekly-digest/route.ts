import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { renderAuditDigestEmail } from "@/lib/email/audit-digest-template";
import { sendAuditDigestEmail } from "@/lib/email/cf-email-client";

const DAY_MS = 24 * 60 * 60 * 1000;

type Locale = Parameters<typeof renderAuditDigestEmail>[0]["locale"];

type AuditReportDigestRow = {
  id: string;
  company_id: string | null;
  health_score: number;
  scanned_at: string;
  companies:
    | {
        id: string;
        name: string;
        owner_id: string;
      }
    | Array<{
        id: string;
        name: string;
        owner_id: string;
      }>
    | null;
};

type AuditIssueDigestRow = {
  id: string;
  rule_id: string;
  page: string;
  suggested: string | null;
  estimated_impact: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type DigestResult = {
  companyId: string;
  companyName: string;
  status: "sent" | "skipped" | "failed";
  newIssues?: number;
  resolvedIssues?: number;
  healthScoreCurrent?: number;
  healthScoreDelta?: number;
  messageId?: string;
  error?: string;
};

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const weekStart = new Date(now.getTime() - 7 * DAY_MS);
  const previousWeekStart = new Date(now.getTime() - 14 * DAY_MS);

  const { data: reportRows, error: reportsError } = await supabase
    .from("audit_reports")
    .select(
      "id, company_id, health_score, scanned_at, companies(id, name, owner_id)",
    )
    .gte("scanned_at", previousWeekStart.toISOString())
    .not("company_id", "is", null)
    .order("scanned_at", { ascending: false });

  if (reportsError) {
    console.error("[Audit Weekly Digest] Failed to load recent reports", {
      error: reportsError,
    });
    return NextResponse.json(
      { success: false, error: "Failed to load audit reports" },
      { status: 500 },
    );
  }

  const reports = (reportRows ?? []) as AuditReportDigestRow[];
  const reportsByCompany = groupReportsByCompany(reports);
  const activeCompanies = Array.from(reportsByCompany.entries()).filter(
    ([, companyReports]) =>
      companyReports.some((report) => new Date(report.scanned_at) >= weekStart),
  );

  if (activeCompanies.length === 0) {
    console.log("[Audit Weekly Digest] No companies with recent audit reports");
    return NextResponse.json({
      success: true,
      processed: 0,
      skipped: 0,
      sent: 0,
      failed: 0,
    });
  }

  const weekIso = getIsoWeekKey(now);
  const details: DigestResult[] = [];

  for (const [companyId, companyReports] of activeCompanies) {
    const sortedReports = [...companyReports].sort(
      (a, b) =>
        new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime(),
    );
    const currentReport = sortedReports.find(
      (report) => new Date(report.scanned_at) >= weekStart,
    );
    const previousReport = sortedReports.find(
      (report) => new Date(report.scanned_at) < weekStart,
    );
    const company = normalizeCompany(currentReport?.companies);

    if (!currentReport || !company) {
      details.push({
        companyId,
        companyName: company?.name ?? companyId,
        status: "skipped",
        error: "company_or_current_report_missing",
      });
      continue;
    }

    const { data: issueRows, error: issuesError } = await supabase
      .from("audit_issues")
      .select(
        "id, rule_id, page, suggested, estimated_impact, status, created_at, updated_at, audit_reports!inner(company_id)",
      )
      .eq("audit_reports.company_id", companyId);

    if (issuesError) {
      console.error("[Audit Weekly Digest] Failed to load issues", {
        companyId,
        error: issuesError,
      });
      details.push({
        companyId,
        companyName: company.name,
        status: "failed",
        error: "audit_issues_load_failed",
      });
      continue;
    }

    const issues = (issueRows ?? []) as AuditIssueDigestRow[];
    const delta = buildDelta(issues, currentReport, previousReport, weekStart);
    const owner = await loadOwner(supabase, company.owner_id);

    if (!owner.email) {
      details.push({
        companyId,
        companyName: company.name,
        status: "skipped",
        error: "owner_email_missing",
      });
      continue;
    }

    const template = renderAuditDigestEmail({
      companyName: company.name,
      weekStart: toDateString(weekStart),
      weekEnd: toDateString(now),
      delta,
      topRecommendations: getTopRecommendations(issues),
      dashboardUrl: getDashboardUrl(),
      locale: normalizeLocale(owner.locale),
    });

    const idempotencyKey = `audit-digest:${companyId}:${weekIso}`;

    try {
      const sendResult = await sendAuditDigestEmail({
        to: owner.email,
        template,
        idempotencyKey,
      });

      if (!sendResult.ok) {
        details.push({
          companyId,
          companyName: company.name,
          status: "failed",
          error: sendResult.error ?? "cf_email_send_failed",
          ...delta,
        });
        continue;
      }

      await writeEmailLog(supabase, {
        companyId,
        to: owner.email,
        idempotencyKey,
        messageId: sendResult.messageId ?? null,
        status: "sent",
      });

      details.push({
        companyId,
        companyName: company.name,
        status: "sent",
        messageId: sendResult.messageId,
        ...delta,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      console.error("[Audit Weekly Digest] Failed to send digest", {
        companyId,
        error: message,
      });
      details.push({
        companyId,
        companyName: company.name,
        status: "failed",
        error: message,
        ...delta,
      });
    }
  }

  return NextResponse.json({
    success: true,
    processed: details.length,
    skipped: details.filter((detail) => detail.status === "skipped").length,
    sent: details.filter((detail) => detail.status === "sent").length,
    failed: details.filter((detail) => detail.status === "failed").length,
    details,
  });
}

function groupReportsByCompany(reports: AuditReportDigestRow[]) {
  const grouped = new Map<string, AuditReportDigestRow[]>();
  for (const report of reports) {
    if (!report.company_id) continue;
    const companyReports = grouped.get(report.company_id) ?? [];
    companyReports.push(report);
    grouped.set(report.company_id, companyReports);
  }
  return grouped;
}

function normalizeCompany(
  reportCompany: AuditReportDigestRow["companies"] | undefined,
) {
  if (!reportCompany) return null;
  if (Array.isArray(reportCompany)) return reportCompany[0] ?? null;
  return reportCompany;
}

function buildDelta(
  issues: AuditIssueDigestRow[],
  currentReport: AuditReportDigestRow,
  previousReport: AuditReportDigestRow | undefined,
  weekStart: Date,
) {
  const newIssues = issues.filter(
    (issue) =>
      issue.status === "open" && new Date(issue.created_at) >= weekStart,
  ).length;
  const resolvedIssues = issues.filter(
    (issue) =>
      ["auto-applied", "resolved"].includes(issue.status) &&
      new Date(issue.updated_at) >= weekStart,
  ).length;
  const previousScore =
    previousReport?.health_score ?? currentReport.health_score;

  return {
    newIssues,
    resolvedIssues,
    healthScoreCurrent: currentReport.health_score,
    healthScoreDelta: currentReport.health_score - previousScore,
  };
}

function getTopRecommendations(issues: AuditIssueDigestRow[]) {
  return issues
    .filter(
      (issue) =>
        issue.estimated_impact === "high" &&
        ["open", "pending-review"].includes(issue.status),
    )
    .slice(0, 3)
    .map((issue) => ({
      ruleId: issue.rule_id,
      page: issue.page,
      suggested: issue.suggested ?? "",
    }));
}

async function loadOwner(
  supabase: ReturnType<typeof createAdminClient>,
  ownerId: string,
) {
  const { data, error } = await supabase.auth.admin.getUserById(ownerId);
  if (error || !data?.user) {
    console.error("[Audit Weekly Digest] Failed to load owner", {
      ownerId,
      error,
    });
    return { email: null, locale: null };
  }

  return {
    email: data.user.email ?? null,
    locale: data.user.user_metadata?.locale ?? null,
  };
}

function normalizeLocale(locale: unknown): Locale {
  const supported: Locale[] = [
    "zh-TW",
    "en-US",
    "ja-JP",
    "ko-KR",
    "de-DE",
    "es-ES",
    "fr-FR",
  ];

  return supported.includes(locale as Locale) ? (locale as Locale) : "zh-TW";
}

function getDashboardUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!baseUrl) return "/dashboard/audit";

  return new URL("/dashboard/audit", baseUrl).toString();
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getIsoWeekKey(date: Date) {
  const utcDate = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
  );

  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function writeEmailLog(
  supabase: ReturnType<typeof createAdminClient>,
  input: {
    companyId: string;
    to: string;
    idempotencyKey: string;
    messageId: string | null;
    status: string;
  },
) {
  try {
    const result = await (
      supabase.from("email_logs" as never) as unknown as {
        insert: (
          payload: Record<string, unknown>,
        ) => PromiseLike<{ error?: unknown }>;
      }
    ).insert({
      company_id: input.companyId,
      recipient: input.to,
      provider: "cf-email",
      template: "audit-weekly-digest",
      idempotency_key: input.idempotencyKey,
      provider_message_id: input.messageId,
      status: input.status,
    });

    if (result.error) {
      console.log("[Audit Weekly Digest] email_logs insert skipped", {
        companyId: input.companyId,
        error: result.error,
      });
    }
  } catch (error) {
    console.log("[Audit Weekly Digest] email_logs insert skipped", {
      companyId: input.companyId,
      error,
    });
  }
}
