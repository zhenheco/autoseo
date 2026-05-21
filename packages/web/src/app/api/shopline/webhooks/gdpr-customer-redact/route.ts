import { NextResponse } from "next/server";

const HMAC_HEADER_NAMES = ["x-shopline-hmac-sha256", "x-hmac-sha256"] as const;

export async function POST(request: Request) {
  logHeaderNames("customer-redact", request.headers);

  const hmacHeader = getHmacHeader(request.headers);
  if (!hmacHeader) {
    return NextResponse.json({ error: "invalid_hmac" }, { status: 401 });
  }

  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}

function getHmacHeader(headers: Headers): string | null {
  for (const name of HMAC_HEADER_NAMES) {
    const value = headers.get(name);
    if (value) return value;
  }

  return null;
}

function logHeaderNames(webhookType: string, headers: Headers) {
  console.info("shopline_gdpr_webhook_headers", {
    webhookType,
    headerNames: Array.from(headers.keys()).sort(),
  });
}
