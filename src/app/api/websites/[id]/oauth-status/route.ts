import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WebsiteOAuthStatus } from "@/types/google-analytics.types";

/**
 * GET /api/websites/[id]/oauth-status
 * 取得網站的 Google OAuth 連接狀態
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: websiteId } = await params;

    // 驗證用戶登入狀態
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    // 驗證用戶有權限存取該網站
    const { data: website } = await supabase
      .from("website_configs")
      .select("id, company_id")
      .eq("id", websiteId)
      .single();

    if (!website) {
      return NextResponse.json({ error: "網站不存在" }, { status: 404 });
    }

    // 驗證用戶是該公司成員
    const { data: membership } = await supabase
      .from("company_members")
      .select("id")
      .eq("company_id", website.company_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!membership) {
      return NextResponse.json({ error: "無權限存取此網站" }, { status: 403 });
    }

    // 使用 admin client 取得 OAuth tokens（因為需要讀取加密欄位）
    const adminClient = createAdminClient();

    // 取得 GSC token
    const { data: gscToken } = await adminClient
      .from("google_oauth_tokens")
      .select("google_account_email, gsc_site_url, status")
      .eq("website_id", websiteId)
      .eq("service_type", "gsc")
      .eq("status", "active")
      .single();

    // 取得 GA4 token
    const { data: ga4Token } = await adminClient
      .from("google_oauth_tokens")
      .select("google_account_email, ga4_property_id, status")
      .eq("website_id", websiteId)
      .eq("service_type", "ga4")
      .eq("status", "active")
      .single();

    const status: WebsiteOAuthStatus = {
      gsc_connected: !!gscToken,
      gsc_email: gscToken?.google_account_email || null,
      gsc_site_url: gscToken?.gsc_site_url || null,
      ga4_connected: !!ga4Token,
      ga4_email: ga4Token?.google_account_email || null,
      ga4_property_id: ga4Token?.ga4_property_id || null,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("[OAuth Status] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
