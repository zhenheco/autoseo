import { NextResponse } from "next/server";

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

  const turnstile = await verifyTurnstileToken({
    token: turnstileToken,
    remoteIp: getRemoteIp(request),
  });
  if (!turnstile.success) {
    return jsonError("turnstile_invalid", "Turnstile token is invalid", 400);
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
