import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import type { AuditIssue, AuditReport } from "@audit";
import type { Json } from "@/types/database.types";

type PublicAuditRequestBody = {
  url?: unknown;
  turnstileToken?: unknown;
};

export async function POST(request: Request) {
  let body: PublicAuditRequestBody;
  try {
    body = (await request.json()) as PublicAuditRequestBody;
  } catch {
    return jsonError("invalid_request", "Request body must be valid JSON", 400);
  }

  const url = normalizeUrl(body.url);
  if (!url) {
    return jsonError("invalid_url", "Invalid URL", 400);
  }

  const turnstileToken =
    typeof body.turnstileToken === "string" ? body.turnstileToken.trim() : "";
  if (!turnstileToken) {
    return jsonError("turnstile_invalid", "Turnstile token is required", 400);
  }

  const remoteIp = getRemoteIp(request);
  const turnstile = await verifyTurnstileToken({
    token: turnstileToken,
    remoteIp,
  });
  if (!turnstile.success) {
    return jsonError("turnstile_invalid", "Turnstile token is invalid", 400);
  }

  const supabase = createAdminClient();
  const ipHash = createIpHash(remoteIp);
  const rateLimited = await isRateLimited(supabase, ipHash);
  if (rateLimited) {
    return jsonError("rate_limited", "Too many audit requests", 429);
  }

  const cached = await findCachedReport(supabase, url);
  if (cached) {
    return NextResponse.json(
      toPublicAuditResponse(cached.reportId, cached.report),
    );
  }

  return jsonError("not_implemented", "Public audit is not implemented", 501);
}

async function verifyTurnstileToken(input: {
  token: string;
  remoteIp: string | null;
}) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { success: false };
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        response: input.token,
        remoteip: input.remoteIp ?? undefined,
      }),
    },
  );

  const data = (await response.json()) as { success?: boolean };
  return { success: data.success === true };
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

async function isRateLimited(
  supabase: ReturnType<typeof createAdminClient>,
  ipHash: string,
) {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("audit_lead_inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("scanned_at", oneHourAgo);

  if (error) throw error;
  return (count ?? 0) >= 5;
}

async function findCachedReport(
  supabase: ReturnType<typeof createAdminClient>,
  url: string,
) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("audit_reports")
    .select("id, health_score, raw_payload, scanned_at")
    .eq("source", "lead-gen")
    .eq("url", url)
    .gt("scanned_at", cutoff)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const rawPayload = data.raw_payload as Json;
  const report = rawPayload as unknown as AuditReport;
  return {
    reportId: data.id as string,
    report: {
      ...report,
      healthScore:
        typeof report.healthScore === "number"
          ? report.healthScore
          : (data.health_score as number),
    },
  };
}

function toPublicAuditResponse(reportId: string, report: AuditReport) {
  return {
    reportId,
    healthScore: report.healthScore,
    topIssues: selectTopIssues(report.issues),
    totalIssues: report.issues.length,
  };
}

function selectTopIssues(issues: AuditIssue[]) {
  return [...issues]
    .sort((a, b) => issuePriority(b) - issuePriority(a))
    .slice(0, 5)
    .map((issue) => ({
      rule: issue.ruleId,
      page: issue.page,
      impact: issue.suggested?.trim() || issue.current,
    }));
}

function issuePriority(issue: AuditIssue) {
  const severity = { critical: 3, warning: 2, info: 1 }[issue.severity];
  const impact = { high: 3, medium: 2, low: 1 }[issue.estimatedImpact];
  const risk = { high: 3, medium: 2, low: 1 }[issue.riskLevel];
  return severity * 100 + impact * 10 + risk;
}

function normalizeUrl(input: unknown) {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: code, message }, { status });
}
