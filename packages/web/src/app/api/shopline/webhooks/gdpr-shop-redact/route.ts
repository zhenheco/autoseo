import { NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { verifyShoplineHmac } from "@/lib/shopline/verify-webhook-hmac";

const HMAC_HEADER_NAMES = ["x-shopline-hmac-sha256", "x-hmac-sha256"] as const;

export async function POST(request: Request) {
  logHeaderNames("shop-redact", request.headers);

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

  let payload: ShopRedactPayload;
  try {
    payload = JSON.parse(rawBody) as ShopRedactPayload;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const shopDomain = stringOrNull(payload.shop_domain);
  if (!shopDomain) {
    return NextResponse.json(
      { error: "shop_domain_required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: connection, error: connectionError } = await supabase
    .from("shopline_connections")
    .select("website_id")
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  if (connectionError) {
    return NextResponse.json(
      { error: "shopline_connection_lookup_failed" },
      { status: 500 },
    );
  }

  if (!connection) {
    const { error: logError } = await supabase
      .from("shopline_gdpr_redact_log")
      .insert({
        webhook_type: "shop-redact",
        shop_id: stringOrNull(payload.shop_id),
        shop_domain: shopDomain,
        payload_summary: "shop not found; already redacted or never connected",
        processed_at: new Date().toISOString(),
        result: "processed",
      });

    if (logError) {
      return NextResponse.json({ error: "gdpr_log_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  const now = new Date().toISOString();
  const { error: revokeError } = await supabase
    .from("shopline_connections")
    .update({ status: "revoked", revoked_at: now, updated_at: now })
    .eq("shop_domain", shopDomain);

  if (revokeError) {
    return NextResponse.json({ error: "shop_revoke_failed" }, { status: 500 });
  }

  const websiteId = (connection as { website_id?: unknown }).website_id;
  const deletedReports =
    typeof websiteId === "string"
      ? await deleteAuditDataForWebsite(supabase, websiteId)
      : 0;

  const { error: logError } = await supabase
    .from("shopline_gdpr_redact_log")
    .insert({
      webhook_type: "shop-redact",
      shop_id: stringOrNull(payload.shop_id),
      shop_domain: shopDomain,
      payload_summary: `shop data redacted: connection revoked; reports deleted: ${deletedReports}`,
      processed_at: now,
      result: "processed",
    });

  if (logError) {
    return NextResponse.json({ error: "gdpr_log_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

type ShopRedactPayload = {
  shop_id?: unknown;
  shop_domain?: unknown;
};

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

type IdRow = {
  id: string;
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

async function deleteAuditDataForWebsite(
  supabase: SupabaseAdminClient,
  websiteId: string,
) {
  const { data: reports, error: reportsError } = await supabase
    .from("audit_reports")
    .select("id")
    .eq("website_id", websiteId);

  if (reportsError) throw reportsError;

  const reportIds = ((reports ?? []) as IdRow[]).map((row) => row.id);
  if (reportIds.length === 0) return 0;

  const { data: issues, error: issuesError } = await supabase
    .from("audit_issues")
    .select("id")
    .in("report_id", reportIds);

  if (issuesError) throw issuesError;

  const issueIds = ((issues ?? []) as IdRow[]).map((row) => row.id);
  if (issueIds.length > 0) {
    const { error: fixLogError } = await supabase
      .from("audit_fix_log")
      .delete()
      .in("issue_id", issueIds);
    if (fixLogError) throw fixLogError;

    const { error: issuesDeleteError } = await supabase
      .from("audit_issues")
      .delete()
      .in("id", issueIds);
    if (issuesDeleteError) throw issuesDeleteError;
  }

  const { error: reportsDeleteError } = await supabase
    .from("audit_reports")
    .delete()
    .in("id", reportIds);
  if (reportsDeleteError) throw reportsDeleteError;

  return reportIds.length;
}
