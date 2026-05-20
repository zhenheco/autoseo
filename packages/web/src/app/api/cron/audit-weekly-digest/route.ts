import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";

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
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { data: recentReports, error: reportsError } = await supabase
    .from("audit_reports")
    .select(
      "id, company_id, health_score, scanned_at, companies(id, name, owner_id)",
    )
    .gte("scanned_at", weekStart.toISOString())
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

  if (!recentReports || recentReports.length === 0) {
    console.log("[Audit Weekly Digest] No companies with recent audit reports");
    return NextResponse.json({
      success: true,
      processed: 0,
      skipped: 0,
      sent: 0,
      failed: 0,
    });
  }

  return NextResponse.json({
    success: true,
    processed: 0,
    skipped: 0,
    sent: 0,
    failed: 0,
  });
}
