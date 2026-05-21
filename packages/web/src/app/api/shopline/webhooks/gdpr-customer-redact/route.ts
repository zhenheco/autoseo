import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { verifyShoplineHmac } from "@/lib/shopline/verify-webhook-hmac";

const HMAC_HEADER_NAMES = ["x-shopline-hmac-sha256", "x-hmac-sha256"] as const;

export async function POST(request: Request) {
  logHeaderNames("customer-redact", request.headers);

  const rawBody = await request.text();
  const hmacHeader = getHmacHeader(request.headers);
  if (!hmacHeader) {
    return NextResponse.json({ error: "invalid_hmac" }, { status: 401 });
  }
  const isValid = await verifyShoplineHmac(
    rawBody,
    hmacHeader,
    process.env.SHOPLINE_CLIENT_SECRET ?? "",
  );
  if (!isValid) {
    return NextResponse.json({ error: "invalid_hmac" }, { status: 401 });
  }

  let payload: CustomerRedactPayload;
  try {
    payload = JSON.parse(rawBody) as CustomerRedactPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error: logError } = await supabase
    .from("shopline_gdpr_redact_log")
    .insert({
      webhook_type: "customer-redact",
      shop_id: stringOrNull(payload.shop_id),
      shop_domain: stringOrNull(payload.shop_domain),
      payload_summary: "customer email absent; scrubbed: 0 rows",
      processed_at: new Date().toISOString(),
      result: "processed",
    });

  if (logError) {
    return NextResponse.json({ error: "gdpr_log_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

type CustomerRedactPayload = {
  shop_id?: unknown;
  shop_domain?: unknown;
};

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

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
