import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";

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
