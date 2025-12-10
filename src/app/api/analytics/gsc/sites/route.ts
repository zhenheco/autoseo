import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
export async function GET(request: NextRequest) {
  try {
    // 驗證用戶登入狀態
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const websiteId = searchParams.get("website_id");

    if (!websiteId) {
      return NextResponse.json(
        { error: "缺少 website_id 參數" },
        { status: 400 },
      );
    }

    // 取得 OAuth token
    const tokenRecord = await getWebsiteOAuthToken(websiteId, "gsc");

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
}
