import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  callGoogleApi,
  getWebsiteOAuthToken,
  updateLastSyncTime,
} from "@/lib/analytics/google-api-client";
import type {
  GA4TrafficRow,
  GA4TrafficSummary,
} from "@/types/google-analytics.types";

const GA4_DATA_API_BASE = "https://analyticsdata.googleapis.com/v1beta";

interface GA4ReportResponse {
  rows?: Array<{
    dimensionValues: Array<{ value: string }>;
    metricValues: Array<{ value: string }>;
  }>;
  rowCount?: number;
}

/**
 * GET /api/analytics/ga4/traffic
 * 取得 Google Analytics 4 流量數據
 *
 * Query Parameters:
 * - website_id: 網站 ID
 * - start_date: 開始日期（YYYY-MM-DD，可選，預設 28 天前）
 * - end_date: 結束日期（YYYY-MM-DD，可選，預設今天）
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

    // 預設日期範圍：過去 28 天
    const endDate =
      searchParams.get("end_date") || new Date().toISOString().split("T")[0];
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 28);
    const startDate =
      searchParams.get("start_date") ||
      defaultStartDate.toISOString().split("T")[0];

    if (!websiteId) {
      return NextResponse.json(
        { error: "缺少 website_id 參數" },
        { status: 400 },
      );
    }

    // 取得 OAuth token
    const tokenRecord = await getWebsiteOAuthToken(websiteId, "ga4");

    if (!tokenRecord) {
      return NextResponse.json(
        { error: "尚未連接 Google Analytics 4" },
        { status: 400 },
      );
    }

    if (!tokenRecord.ga4_property_id) {
      return NextResponse.json(
        { error: "尚未選擇要追蹤的 GA4 Property" },
        { status: 400 },
      );
    }

    // 檢查快取
    const adminClient = createAdminClient();
    const { data: cachedData } = await adminClient
      .from("analytics_data_cache")
      .select("data, cached_at")
      .eq("website_id", websiteId)
      .eq("data_type", "ga4_traffic")
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

    // 呼叫 GA4 Data API
    const propertyId = tokenRecord.ga4_property_id;
    const { data, error } = await callGoogleApi<GA4ReportResponse>(
      `${GA4_DATA_API_BASE}/${propertyId}:runReport`,
      tokenRecord,
      {
        method: "POST",
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "newUsers" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
          orderBys: [
            { dimension: { orderType: "ALPHANUMERIC", dimensionName: "date" } },
          ],
        }),
      },
    );

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    // 整理數據
    const rows: GA4TrafficRow[] = (data?.rows || []).map((row) => ({
      date: row.dimensionValues[0]?.value || "",
      sessions: parseInt(row.metricValues[0]?.value || "0"),
      users: parseInt(row.metricValues[1]?.value || "0"),
      newUsers: parseInt(row.metricValues[2]?.value || "0"),
      pageviews: parseInt(row.metricValues[3]?.value || "0"),
      bounceRate: parseFloat(row.metricValues[4]?.value || "0"),
      avgSessionDuration: parseFloat(row.metricValues[5]?.value || "0"),
    }));

    // 計算摘要
    const summary: GA4TrafficSummary = {
      totalSessions: rows.reduce((sum, r) => sum + r.sessions, 0),
      totalUsers: rows.reduce((sum, r) => sum + r.users, 0),
      totalPageviews: rows.reduce((sum, r) => sum + r.pageviews, 0),
      avgBounceRate:
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.bounceRate, 0) / rows.length
          : 0,
      avgSessionDuration:
        rows.length > 0
          ? rows.reduce((sum, r) => sum + r.avgSessionDuration, 0) / rows.length
          : 0,
      rows,
    };

    // 儲存快取（1 小時過期，因為 GA4 數據更即時）
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await adminClient.from("analytics_data_cache").upsert(
      {
        website_id: websiteId,
        data_type: "ga4_traffic",
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
    console.error("[GA4 Traffic] 錯誤:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
