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

  return jsonError("not_implemented", "Public audit is not implemented", 501);
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
