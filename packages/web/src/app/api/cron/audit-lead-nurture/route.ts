import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { createAuditLeadUnsubscribeToken } from "@/lib/email/audit-lead-unsubscribe";
import { renderAuditNurtureEmail } from "@/lib/email/audit-nurture-template";
import { sendAuditNurtureEmail } from "@/lib/email/cf-email-client";

const DAY_MS = 24 * 60 * 60 * 1000;

type LeadNurtureRow = {
  id: string;
  email: string | null;
  url: string;
  scanned_at: string;
  nurture_stage: number;
};

type AuditReportLookupRow = {
  health_score: number | null;
  raw_payload: unknown;
};

type NurtureJob = {
  lead: LeadNurtureRow;
  emailStage: 1 | 2;
  nextStage: 2 | 3;
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const stage1Cutoff = new Date(now - 3 * DAY_MS).toISOString();
  const stage2Cutoff = new Date(now - 7 * DAY_MS).toISOString();

  const [stage1Result, stage2Result] = await Promise.all([
    loadDueLeads(supabase, 1, stage1Cutoff),
    loadDueLeads(supabase, 2, stage2Cutoff),
  ]);

  if (stage1Result.error || stage2Result.error) {
    return NextResponse.json(
      { ok: false, error: "Failed to load nurture leads" },
      { status: 500 },
    );
  }

  const jobs: NurtureJob[] = [
    ...stage1Result.leads.map((lead) => ({
      lead,
      emailStage: 1 as const,
      nextStage: 2 as const,
    })),
    ...stage2Result.leads.map((lead) => ({
      lead,
      emailStage: 2 as const,
      nextStage: 3 as const,
    })),
  ].filter((job) => Boolean(job.lead.email));

  const results = await Promise.all(
    jobs.map((job) => processJob(supabase, job)),
  );
  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return NextResponse.json({
    processed: jobs.length,
    sent,
    failed,
  });
}

async function loadDueLeads(
  supabase: ReturnType<typeof createAdminClient>,
  stage: 1 | 2,
  cutoff: string,
): Promise<{ leads: LeadNurtureRow[]; error: unknown | null }> {
  const { data, error } = await supabase
    .from("audit_lead_inquiries")
    .select("id, email, url, scanned_at, nurture_stage")
    .eq("nurture_stage", stage)
    .lte("scanned_at", cutoff)
    .order("scanned_at", { ascending: true });

  return {
    leads: ((data ?? []) as LeadNurtureRow[]).filter((lead) => lead.email),
    error,
  };
}

async function processJob(
  supabase: ReturnType<typeof createAdminClient>,
  job: NurtureJob,
) {
  const email = job.lead.email;
  if (!email) {
    return { leadId: job.lead.id, status: "failed" as const };
  }

  try {
    const report = await loadLatestReport(supabase, job.lead.url);
    const template = renderAuditNurtureEmail({
      stage: job.emailStage,
      recipientEmail: email,
      scannedUrl: job.lead.url,
      healthScore: report.healthScore,
      topIssues: report.topIssues,
      unsubscribeUrl: getAppUrl(
        `/api/public/audit/lead-email/unsubscribe?token=${createAuditLeadUnsubscribeToken(
          job.lead.id,
        )}`,
      ),
      ctaUrl:
        job.emailStage === 2
          ? getAppUrl("/contact?intent=audit-consultation")
          : getAppUrl("/signup?intent=connect-shopline"),
      locale: "zh-TW",
    });
    const sendResult = await sendAuditNurtureEmail({
      to: email,
      template,
      idempotencyKey: `audit-nurture:${job.lead.id}:${job.emailStage}`,
    });

    if (!sendResult.ok) {
      return { leadId: job.lead.id, status: "failed" as const };
    }

    const { error } = await supabase
      .from("audit_lead_inquiries")
      .update({ nurture_stage: job.nextStage })
      .eq("id", job.lead.id)
      .select("id")
      .single();

    return {
      leadId: job.lead.id,
      status: error ? ("failed" as const) : ("sent" as const),
    };
  } catch {
    return { leadId: job.lead.id, status: "failed" as const };
  }
}

async function loadLatestReport(
  supabase: ReturnType<typeof createAdminClient>,
  url: string,
) {
  const { data } = await supabase
    .from("audit_reports")
    .select("health_score, raw_payload")
    .eq("source", "lead-gen")
    .eq("url", url)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = data as AuditReportLookupRow | null;
  return {
    healthScore: row?.health_score ?? 0,
    topIssues: extractTopIssues(row?.raw_payload),
  };
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function extractTopIssues(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== "object") return [];
  const issues = (rawPayload as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];

  return issues
    .map((issue) => {
      if (!issue || typeof issue !== "object") return null;
      const record = issue as {
        ruleId?: unknown;
        rule?: unknown;
        page?: unknown;
      };
      const ruleId =
        typeof record.ruleId === "string"
          ? record.ruleId
          : typeof record.rule === "string"
            ? record.rule
            : null;
      const page = typeof record.page === "string" ? record.page : null;
      return ruleId && page ? { ruleId, page } : null;
    })
    .filter(
      (issue): issue is { ruleId: string; page: string } => issue !== null,
    )
    .slice(0, 5);
}

function getAppUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!baseUrl) return path;
  return new URL(path, baseUrl).toString();
}
