import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@shared/supabase";
import { withRouteAuth } from "@/lib/api/route-auth";
import { resolveCompanyScopeForUser } from "@/lib/api/company-scope";
import {
  callGoogleApi,
  getWebsiteOAuthToken,
} from "@/lib/analytics/google-api-client";
import type { GSCSite } from "@/types/google-analytics.types";

const GSC_API_BASE = "https://searchconsole.googleapis.com/v1";

interface GSCSitesResponse {
  siteEntry?: GSCSite[];
}

/**
 * GET /api/analytics/gsc/sites
 * 列出用戶在 Google Search Console 中已驗證的網站
 *
 * Query Parameters:
 * - website_id: 網站 ID（用於取得 OAuth token）
 */
export const GET = withRouteAuth(
  "authenticated",
  async (request: NextRequest, { user }) => {
    try {
      const searchParams = request.nextUrl.searchParams;
      const websiteId = searchParams.get("website_id");

      if (!websiteId) {
        return NextResponse.json(
          { error: "缺少 website_id 參數" },
          { status: 400 },
        );
      }

      const adminClient = createAdminClient();
      const companyScope = await resolveCompanyScopeForUser(
        adminClient,
        user.id,
      );

      if (!companyScope.success) {
        return NextResponse.json({ error: "無公司權限" }, { status: 403 });
      }

      // 取得 OAuth token
      const tokenRecord = await getWebsiteOAuthToken(
        websiteId,
        "gsc",
        companyScope.companyId,
      );

      if (!tokenRecord) {
        return NextResponse.json(
          { error: "尚未連接 Google Search Console" },
          { status: 400 },
        );
      }

      // 呼叫 GSC API 取得網站列表
      const { data, error } = await callGoogleApi<GSCSitesResponse>(
        `${GSC_API_BASE}/sites`,
        tokenRecord,
      );

      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }

      const sites = data?.siteEntry || [];

      return NextResponse.json({
        success: true,
        sites,
      });
    } catch (error) {
      console.error("[GSC Sites] 錯誤:", error);
      return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
    }
  },
);
