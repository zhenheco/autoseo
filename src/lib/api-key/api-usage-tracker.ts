/**
 * API 使用量追蹤服務
 *
 * 記錄 API 調用並提供統計查詢
 */

import { createClient } from "@supabase/supabase-js";

// 使用 service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * API 使用記錄
 */
export interface ApiUsageLog {
  websiteId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs?: number;
  requestIp?: string;
  userAgent?: string;
}

/**
 * 每日統計
 */
export interface DailyStats {
  date: string;
  endpoint: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  avgResponseTimeMs: number;
  maxResponseTimeMs: number;
}

/**
 * 網站使用量摘要
 */
export interface UsageSummary {
  websiteId: string;
  totalRequests: number;
  todayRequests: number;
  last7DaysRequests: number;
  last30DaysRequests: number;
  topEndpoints: { endpoint: string; count: number }[];
  avgResponseTimeMs: number;
  errorRate: number;
}

/**
 * 記錄 API 使用量
 *
 * @param log API 使用記錄
 */
export async function logApiUsage(log: ApiUsageLog): Promise<void> {
  try {
    await supabase.from("api_usage_logs").insert({
      website_id: log.websiteId,
      endpoint: log.endpoint,
      method: log.method,
      status_code: log.statusCode,
      response_time_ms: log.responseTimeMs,
      request_ip: log.requestIp,
      user_agent: log.userAgent,
    });
  } catch (error) {
    // 記錄失敗不應該影響 API 回應
    console.error("[API Usage Tracker] Error logging usage:", error);
  }
}

/**
 * 取得網站使用量摘要
 *
 * @param websiteId 網站 ID
 * @returns 使用量摘要
 */
export async function getUsageSummary(
  websiteId: string,
): Promise<UsageSummary | null> {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 查詢總請求數
    const { count: totalRequests } = await supabase
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", websiteId);

    // 查詢今日請求數
    const { count: todayRequests } = await supabase
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", websiteId)
      .gte("created_at", today.toISOString());

    // 查詢過去 7 天請求數
    const { count: last7DaysRequests } = await supabase
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", websiteId)
      .gte("created_at", last7Days.toISOString());

    // 查詢過去 30 天請求數
    const { count: last30DaysRequests } = await supabase
      .from("api_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("website_id", websiteId)
      .gte("created_at", last30Days.toISOString());

    // 查詢熱門端點（過去 30 天）
    const { data: endpointStats } = await supabase
      .from("api_usage_logs")
      .select("endpoint")
      .eq("website_id", websiteId)
      .gte("created_at", last30Days.toISOString());

    // 統計端點使用次數
    const endpointCount = new Map<string, number>();
    for (const log of endpointStats || []) {
      endpointCount.set(
        log.endpoint,
        (endpointCount.get(log.endpoint) || 0) + 1,
      );
    }

    const topEndpoints = Array.from(endpointCount.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 查詢平均回應時間和錯誤率（過去 30 天）
    const { data: performanceData } = await supabase
      .from("api_usage_logs")
      .select("response_time_ms, status_code")
      .eq("website_id", websiteId)
      .gte("created_at", last30Days.toISOString());

    let avgResponseTimeMs = 0;
    let errorRate = 0;

    if (performanceData && performanceData.length > 0) {
      const responseTimes = performanceData
        .filter((d) => d.response_time_ms !== null)
        .map((d) => d.response_time_ms as number);

      if (responseTimes.length > 0) {
        avgResponseTimeMs = Math.round(
          responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
        );
      }

      const errorCount = performanceData.filter(
        (d) => d.status_code >= 400,
      ).length;
      errorRate = Math.round((errorCount / performanceData.length) * 100);
    }

    return {
      websiteId,
      totalRequests: totalRequests || 0,
      todayRequests: todayRequests || 0,
      last7DaysRequests: last7DaysRequests || 0,
      last30DaysRequests: last30DaysRequests || 0,
      topEndpoints,
      avgResponseTimeMs,
      errorRate,
    };
  } catch (error) {
    console.error("[API Usage Tracker] Error getting summary:", error);
    return null;
  }
}

/**
 * 取得每日統計
 *
 * @param websiteId 網站 ID
 * @param days 查詢天數（預設 30）
 * @returns 每日統計列表
 */
export async function getDailyStats(
  websiteId: string,
  days: number = 30,
): Promise<DailyStats[]> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from("api_usage_daily_stats")
      .select("*")
      .eq("website_id", websiteId)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => ({
      date: row.date,
      endpoint: row.endpoint,
      requestCount: row.request_count,
      successCount: row.success_count,
      errorCount: row.error_count,
      avgResponseTimeMs: row.avg_response_time_ms,
      maxResponseTimeMs: row.max_response_time_ms,
    }));
  } catch (error) {
    console.error("[API Usage Tracker] Error getting daily stats:", error);
    return [];
  }
}

/**
 * 從 Request 取得客戶端資訊
 */
export function getClientInfo(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  // 嘗試從各種 header 取得 IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null;

  const userAgent = request.headers.get("user-agent");

  return { ip, userAgent };
}
