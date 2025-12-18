/**
 * Redis 健康檢查診斷 API（Upstash 版本）
 * 用於診斷 Redis 連線和效能問題
 *
 * 只允許管理員訪問
 */

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import { getRedisStats } from "@/lib/cache/redis-cache";
import { createClient } from "@/lib/supabase/server";

/**
 * 測量操作延遲的輔助函數
 */
async function measureLatency<T>(operation: () => Promise<T>): Promise<{
  result: T | null;
  latency: number;
  success: boolean;
  error?: string;
}> {
  const start = Date.now();
  try {
    const result = await operation();
    return {
      result,
      latency: Date.now() - start,
      success: true,
    };
  } catch (error) {
    return {
      result: null,
      latency: Date.now() - start,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(request: Request) {
  // 檢查是否有 secret key（允許 curl 訪問）
  const url = new URL(request.url);
  const secretKey = url.searchParams.get("key");
  const validKey = process.env.DEBUG_SECRET_KEY || "redis-health-check-2024";

  const hasValidKey = secretKey === validKey;

  // 如果沒有 secret key，檢查管理員權限
  if (!hasValidKey) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          hint: "請在 URL 加上 ?key=redis-health-check-2024 或以管理員身份登入",
        },
        { status: 401 },
      );
    }

    // 檢查是否為管理員
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }
  }

  // 檢查 Upstash Redis 是否設定
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return NextResponse.json({
      status: "not_configured",
      message:
        "UPSTASH_REDIS_REST_URL 或 UPSTASH_REDIS_REST_TOKEN 環境變數未設定",
      provider: "upstash",
    });
  }

  try {
    // 建立 Upstash Redis 客戶端
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    // 測試 PING
    const pingResult = await measureLatency(() => redis.ping());

    // 測試 SET 操作
    const testKey = `_health_check_${Date.now()}`;
    const testValue = "test_value";
    const setResult = await measureLatency(() =>
      redis.setex(testKey, 60, testValue),
    );

    // 測試 GET 操作
    const getResult = await measureLatency(() => redis.get(testKey));

    // 清理測試 key
    await redis.del(testKey);

    // 取得 key 數量
    const dbsizeResult = await measureLatency(() => redis.dbsize());

    // 計算總體狀態
    const allOperationsSuccess =
      pingResult.success && setResult.success && getResult.success;
    const avgLatency =
      (pingResult.latency + setResult.latency + getResult.latency) / 3;

    let status: "healthy" | "degraded" | "unhealthy";
    let recommendation: string;

    if (!allOperationsSuccess) {
      status = "unhealthy";
      recommendation = "Redis 操作失敗，請檢查 Upstash 服務狀態和憑證";
    } else if (avgLatency > 500) {
      status = "degraded";
      recommendation = `平均延遲過高 (${Math.round(avgLatency)}ms)，建議檢查 Upstash 區域設定是否靠近 Vercel 部署區域`;
    } else if (avgLatency > 200) {
      status = "degraded";
      recommendation = `延遲略高 (${Math.round(avgLatency)}ms)，但在可接受範圍內`;
    } else {
      status = "healthy";
      recommendation = "Upstash Redis 運作正常，延遲良好";
    }

    // 取得執行時期統計（來自應用程式的操作記錄）
    const runtimeStats = getRedisStats();

    return NextResponse.json({
      status,
      provider: "upstash",
      timestamp: new Date().toISOString(),
      operations: {
        ping: {
          latency: pingResult.latency,
          success: pingResult.success,
          error: pingResult.error,
        },
        set: {
          latency: setResult.latency,
          success: setResult.success,
          error: setResult.error,
        },
        get: {
          latency: getResult.latency,
          success: getResult.success,
          error: getResult.error,
        },
      },
      database: {
        keyCount: dbsizeResult.result ?? 0,
      },
      runtimeStats: {
        totalOperations: runtimeStats.totalOperations,
        successRate: runtimeStats.successRate,
        avgLatency: runtimeStats.avgLatency,
        timeoutRate: runtimeStats.timeoutRate,
        connectionErrorRate: runtimeStats.connectionErrorRate,
        lastError: runtimeStats.lastError,
        lastErrorTime: runtimeStats.lastErrorTime,
        operationBreakdown: runtimeStats.operationBreakdown,
      },
      summary: {
        avgLatency: Math.round(avgLatency),
        allOperationsSuccess,
        recommendation,
      },
      config: {
        provider: "upstash",
        connectionType: "HTTP (REST API)",
        note: "Upstash 使用 HTTP API，無連線管理問題",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // 分析錯誤類型
    let diagnosis: string;
    if (errorMessage.includes("Unauthorized")) {
      diagnosis = "認證失敗 - 請檢查 UPSTASH_REDIS_REST_TOKEN 是否正確";
    } else if (errorMessage.includes("fetch")) {
      diagnosis = "網路錯誤 - 請檢查 UPSTASH_REDIS_REST_URL 是否正確";
    } else {
      diagnosis = "未知錯誤 - 請檢查 Upstash Dashboard 確認服務狀態";
    }

    return NextResponse.json({
      status: "unhealthy",
      provider: "upstash",
      timestamp: new Date().toISOString(),
      error: errorMessage,
      diagnosis,
      recommendation: "請檢查 Upstash 憑證和服務狀態",
    });
  }
}
