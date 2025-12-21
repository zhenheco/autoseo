/**
 * 網站 OAuth 連接狀態 API
 */

import { withFullAuth, extractPathParams } from "@/lib/api/auth-middleware";
import { successResponse, notFound } from "@/lib/api/response-helpers";
import type { WebsiteOAuthStatus } from "@/types/google-analytics.types";

/**
 * GET /api/websites/[id]/oauth-status
 * 取得網站的 Google OAuth 連接狀態
 */
export const GET = withFullAuth(
  async (request, { supabase, companyId, adminClient }) => {
    const { id: websiteId } = extractPathParams(request);

    if (!websiteId) {
      return notFound("網站");
    }

    // 驗證網站屬於該公司
    const { data: website } = await supabase
      .from("website_configs")
      .select("id")
      .eq("id", websiteId)
      .eq("company_id", companyId)
      .single();

    if (!website) {
      return notFound("網站");
    }

    // 使用 admin client 取得 GSC token（因為需要讀取加密欄位）
    const { data: gscToken } = await adminClient
      .from("google_oauth_tokens")
      .select("google_account_email, gsc_site_url, status")
      .eq("website_id", websiteId)
      .eq("service_type", "gsc")
      .eq("status", "active")
      .single();

    const status: WebsiteOAuthStatus = {
      gsc_connected: !!gscToken,
      gsc_email: gscToken?.google_account_email || null,
      gsc_site_url: gscToken?.gsc_site_url || null,
    };

    return successResponse(status);
  },
);
