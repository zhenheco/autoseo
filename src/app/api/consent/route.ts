import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/consent
 * 記錄用戶的 Cookie 同意狀態（GDPR 合規）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      visitor_id,
      analytics_consent,
      marketing_consent,
      consent_version,
    } = body;

    if (!visitor_id) {
      return NextResponse.json({ error: "缺少 visitor_id" }, { status: 400 });
    }

    // 取得用戶的國家代碼（從 Cloudflare header 或其他來源）
    const ipCountry =
      request.headers.get("cf-ipcountry") ||
      request.headers.get("x-vercel-ip-country") ||
      null;

    const userAgent = request.headers.get("user-agent") || null;

    const adminClient = createAdminClient();

    // 使用 upsert 來插入或更新記錄
    const { error } = await adminClient.from("cookie_consent_log").upsert(
      {
        visitor_id,
        analytics_consent: analytics_consent ?? false,
        marketing_consent: marketing_consent ?? false,
        consent_version: consent_version || "1.0",
        ip_country: ipCountry,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "visitor_id",
      },
    );

    if (error) {
      console.error("[Consent API] 儲存同意記錄失敗:", error);
      // 即使儲存失敗，也不影響用戶體驗
      return NextResponse.json({ success: true, stored: false });
    }

    return NextResponse.json({ success: true, stored: true });
  } catch (error) {
    console.error("[Consent API] 處理請求失敗:", error);
    // 即使發生錯誤，也不影響用戶體驗
    return NextResponse.json({ success: true, stored: false });
  }
}
