/**
 * Redis 健康檢查診斷 API
 * 用於診斷 Redis 連線和效能問題
 *
 * 只允許管理員訪問
 */

import { NextResponse } from "next/server";
import Redis from "ioredis";

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

/**
 * 解析 Redis INFO 命令的輸出
 */
function parseRedisInfo(info: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = info.split("\n");
  for (const line of lines) {
    if (line.includes(":")) {
      const [key, value] = line.split(":");
      result[key.trim()] = value?.trim() || "";
    }
  }
  return result;
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

  // 檢查 Redis URL 是否設定
  if (!process.env.REDIS_URL) {
    return NextResponse.json({
      status: "not_configured",
      message: "REDIS_URL 環境變數未設定",
    });
  }

  // 建立獨立的 Redis 連線進行診斷
  let redis: Redis | null = null;

  try {
    // 測量連線時間
    const connectStart = Date.now();
    redis = new Redis(process.env.REDIS_URL, {
      connectTimeout: 10000, // 診斷用，給更多時間
      commandTimeout: 10000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    // 連線
    await redis.connect();
    const connectLatency = Date.now() - connectStart;

    // 測試 PING
    const pingResult = await measureLatency(() => redis!.ping());

    // 測試 SET 操作
    const testKey = `_health_check_${Date.now()}`;
    const testValue = "test_value";
    const setResult = await measureLatency(() =>
      redis!.setex(testKey, 60, testValue),
    );

    // 測試 GET 操作
    const getResult = await measureLatency(() => redis!.get(testKey));

    // 清理測試 key
    await redis.del(testKey);

    // 取得 Redis 伺服器資訊
    const infoResult = await measureLatency(() => redis!.info());
    const serverInfo = infoResult.result
      ? parseRedisInfo(infoResult.result)
      : {};

    // 取得 key 數量
    const dbsizeResult = await measureLatency(() => redis!.dbsize());

    // 計算總體狀態
    const allOperationsSuccess =
      pingResult.success && setResult.success && getResult.success;
    const avgLatency =
      (pingResult.latency + setResult.latency + getResult.latency) / 3;

    let status: "healthy" | "degraded" | "unhealthy";
    let recommendation: string;

    if (!allOperationsSuccess) {
      status = "unhealthy";
      recommendation = "Redis 操作失敗，請檢查連線和伺服器狀態";
    } else if (avgLatency > 500) {
      status = "degraded";
      recommendation = `平均延遲過高 (${Math.round(avgLatency)}ms)，建議：1) 檢查 Zeabur Redis 區域設定 2) 考慮遷移到 Upstash (邊緣位置更近) 3) 增加 commandTimeout`;
    } else if (avgLatency > 200) {
      status = "degraded";
      recommendation = `延遲略高 (${Math.round(avgLatency)}ms)，建議將 commandTimeout 從 3000ms 增加到 5000ms`;
    } else {
      status = "healthy";
      recommendation = "Redis 運作正常";
    }

    // 取得執行時期統計（來自應用程式的操作記錄）
    const runtimeStats = getRedisStats();

    return NextResponse.json({
      status,
      timestamp: new Date().toISOString(),
      connection: {
        latency: connectLatency,
        success: true,
      },
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
      serverInfo: {
        version: serverInfo.redis_version || "unknown",
        connectedClients: serverInfo.connected_clients || "unknown",
        usedMemory: serverInfo.used_memory_human || "unknown",
        maxMemory: serverInfo.maxmemory_human || "unknown",
        uptimeSeconds: serverInfo.uptime_in_seconds || "unknown",
        role: serverInfo.role || "unknown",
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
        currentTimeout: 3000,
        suggestedTimeout: avgLatency > 200 ? 5000 : 3000,
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // 分析錯誤類型
    let diagnosis: string;
    if (errorMessage.includes("ECONNREFUSED")) {
      diagnosis = "連線被拒絕 - Redis 伺服器可能未啟動或 URL 錯誤";
    } else if (errorMessage.includes("ETIMEDOUT")) {
      diagnosis = "連線超時 - 網路延遲過高或防火牆阻擋";
    } else if (errorMessage.includes("ENOTFOUND")) {
      diagnosis = "找不到主機 - Redis URL 的主機名稱錯誤";
    } else if (errorMessage.includes("timed out")) {
      diagnosis = "命令超時 - Redis 伺服器響應過慢";
    } else {
      diagnosis = "未知錯誤 - 請檢查 Redis URL 和伺服器狀態";
    }

    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: errorMessage,
      diagnosis,
      recommendation: "請檢查 Zeabur Redis 服務狀態，或考慮遷移到 Upstash",
    });
  } finally {
    if (redis) {
      try {
        redis.disconnect();
      } catch {
        // 忽略斷開連線錯誤
      }
    }
  }
}
