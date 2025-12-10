import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  callGoogleApi,
  getWebsiteOAuthToken,
  getDefaultDateRange,
  updateLastSyncTime,
} from "@/lib/analytics/google-api-client";
import type {
  GSCPerformanceResponse,
  GSCPerformanceSummary,
  GSCDailyPerformance,
} from "@/types/google-analytics.types";

const GSC_API_BASE = "https://searchconsole.googleapis.com/v1";

/**
 * GET /api/analytics/gsc/performance
 * 取得 Google Search Console 搜尋效能數據
 *
 * Query Parameters:
 * - website_id: 網站 ID
 * - start_date: 開始日期（YYYY-MM-DD，可選）
 * - end_date: 結束日期（YYYY-MM-DD，可選）
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
    const { startDate: defaultStart, endDate: defaultEnd } =
      getDefaultDateRange();
    const startDate = searchParams.get("start_date") || defaultStart;
    const endDate = searchParams.get("end_date") || defaultEnd;

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

    if (!tokenRecord.gsc_site_url) {
      return NextResponse.json(
        { error: "尚未選擇要追蹤的網站" },
        { status: 400 },
      );
    }

    // 檢查快取
    const adminClient = createAdminClient();
    const { data: cachedData } = await adminClient
      .from("analytics_data_cache")
      .select("data, cached_at")
      .eq("website_id", websiteId)
      .eq("data_type", "gsc_performance")
      .eq("date_start", startDate)
      .eq("date_end", endDate)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (cachedData) {
      return NextResponse.json({
        success: true,
        cached: true,
        cached_at: cachedData.cached_at,
        ...cachedData.data,
      });
    }

    // 呼叫 GSC API
    const siteUrl = encodeURIComponent(tokenRecord.gsc_site_url);
    const { data, error } = await callGoogleApi<GSCPerformanceResponse>(
      `${GSC_API_BASE}/sites/${siteUrl}/searchAnalytics/query`,
      tokenRecord,
      {
        method: "POST",
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["date"],
          type: "web",
          rowLimit: 500,
        }),
      },
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    // 整理數據
    const rows: GSCDailyPerformance[] = (data?.rows || []).map((row) => ({
      date: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    }));

    // 計算摘要
    const summary: GSCPerformanceSummary = {
      totalClicks: rows.reduce((sum, r) => sum + r.clicks, 0),
      totalImpressions: rows.reduce((sum, r) => sum + r.impressions, 0),
      avgCtr:
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.ctr, 0) / rows.length
          : 0,
      avgPosition:
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.position, 0) / rows.length
          : 0,
      rows,
    };

    // 儲存快取（6 小時過期）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    await adminClient.from("analytics_data_cache").upsert(
      {
        website_id: websiteId,
        data_type: "gsc_performance",
        date_start: startDate,
        date_end: endDate,
        filter_params: {},
        data: summary,
        row_count: rows.length,
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: "website_id,data_type,date_start,date_end,filter_params",
      },
    );

    // 更新最後同步時間
    await updateLastSyncTime(tokenRecord.id);

    return NextResponse.json({
      success: true,
      cached: false,
      ...summary,
    });
  } catch (error) {
    console.error("[GSC Performance] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
