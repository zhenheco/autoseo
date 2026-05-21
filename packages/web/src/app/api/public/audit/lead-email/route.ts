import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { createAuditLeadUnsubscribeToken } from "@/lib/email/audit-lead-unsubscribe";
import { renderAuditNurtureEmail } from "@/lib/email/audit-nurture-template";
import { sendAuditNurtureEmail } from "@/lib/email/cf-email-client";

type LeadEmailBody = {
  reportId?: unknown;
  email?: unknown;
};

type Locale = Parameters<typeof renderAuditNurtureEmail>[0]["locale"];

type AuditReportRow = {
  id: string;
  url: string;
  health_score: number;
  raw_payload: unknown;
};

type LeadRow = {
  id: string;
  url: string;
  email: string | null;
  ip_hash: string;
  scanned_at: string;
  nurture_stage: number;
};

export async function POST(request: Request) {
  let body: LeadEmailBody;
  try {
    body = (await request.json()) as LeadEmailBody;
  } catch {
    return jsonError("invalid_request", "Request body must be valid JSON", 400);
  }

  const reportId = typeof body.reportId === "string" ? body.reportId : "";
  const email = normalizeEmail(body.email);
  if (!reportId) {
    return jsonError("invalid_request", "reportId is required", 400);
  }
  if (!email) {
    return jsonError("invalid_email", "Email is invalid", 400);
  }

  const supabase = createAdminClient();
  const { data: reportData, error: reportError } = await supabase
    .from("audit_reports")
    .select("id, url, health_score, raw_payload")
    .eq("id", reportId)
    .eq("source", "lead-gen")
    .single();

  if (reportError || !reportData) {
    return jsonError("report_not_found", "Audit report not found", 404);
  }

  const report = reportData as AuditReportRow;
  const ipHash = createIpHash(getRemoteIp(request));
  const { data: leadData, error: leadError } = await supabase
    .from("audit_lead_inquiries")
    .select("id, url, email, ip_hash, scanned_at, nurture_stage")
    .eq("ip_hash", ipHash)
    .eq("url", report.url)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (leadError) {
    return jsonError("lead_lookup_failed", "Unable to load lead inquiry", 500);
  }
  if (!leadData) {
    return jsonError("lead_not_found", "Lead inquiry not found", 404);
  }

  const lead = leadData as LeadRow;
  const unsubscribeUrl = getAppUrl(
    `/api/public/audit/lead-email/unsubscribe?token=${createAuditLeadUnsubscribeToken(
      lead.id,
    )}`,
  );
  const template = renderAuditNurtureEmail({
    stage: 0,
    recipientEmail: email,
    scannedUrl: report.url,
    healthScore: report.health_score,
    topIssues: extractTopIssues(report.raw_payload),
    unsubscribeUrl,
    ctaUrl: getAppUrl("/signup?intent=connect-shopline"),
    locale: normalizeLocale(request.headers.get("accept-language")),
  });
  const sendResult = await sendAuditNurtureEmail({
    to: email,
    template,
    idempotencyKey: `audit-nurture:${lead.id}:0`,
  });

  if (!sendResult.ok) {
    return jsonError(
      "email_send_failed",
      sendResult.error ?? "Email send failed",
      502,
    );
  }

  const { error: updateError } = await supabase
    .from("audit_lead_inquiries")
    .update({ email, nurture_stage: 1 })
    .eq("id", lead.id)
    .select("id")
    .single();

  if (updateError) {
    return jsonError(
      "lead_update_failed",
      "Unable to update lead inquiry",
      500,
    );
  }

  return NextResponse.json({ ok: true });
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function getRemoteIp(request: Request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;

  return request.headers.get("x-real-ip");
}

function createIpHash(remoteIp: string | null, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const salt =
    process.env.PUBLIC_AUDIT_IP_HASH_SALT ??
    process.env.TURNSTILE_SECRET_KEY ??
    "public-audit";

  return createHash("sha256")
    .update(`${remoteIp ?? "unknown"}:${date}:${salt}`)
    .digest("hex")
    .slice(0, 16);
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

function normalizeLocale(acceptLanguage: string | null): Locale {
  const supported: Locale[] = [
    "zh-TW",
    "en-US",
    "ja-JP",
    "ko-KR",
    "de-DE",
    "es-ES",
    "fr-FR",
  ];
  const value = acceptLanguage?.split(",")[0]?.trim();
  return supported.includes(value as Locale) ? (value as Locale) : "zh-TW";
}

function getAppUrl(path: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

  if (!baseUrl) return path;
  return new URL(path, baseUrl).toString();
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}
