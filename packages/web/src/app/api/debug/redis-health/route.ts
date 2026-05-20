/**
 * 快取健康檢查診斷 API（Cloudflare KV 版本）
 * 用於診斷 KV 快取連線和效能問題
 *
 * 只允許管理員訪問
 */

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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
  const validKey = process.env.DEBUG_SECRET_KEY || "cache-health-check-2024";

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
          hint: "請在 URL 加上 ?key=cache-health-check-2024 或以管理員身份登入",
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

  // 檢查 KV binding 是否存在
  let kv: KVNamespace | null = null;
  try {
    const { env } = getCloudflareContext();
    kv = (env as Record<string, unknown>).CACHE_KV as KVNamespace | null;
  } catch {
    // 非 CF 環境
  }

  if (!kv) {
    return NextResponse.json({
      status: "not_configured",
      message:
        "CACHE_KV binding 未設定，請確認 wrangler.jsonc 的 kv_namespaces 配置",
      provider: "cloudflare-kv",
    });
  }

  try {
    // 測試 PUT 操作
    const testKey = `_health_check_${Date.now()}`;
    const testValue = "test_value";
    const setResult = await measureLatency(() =>
      kv!.put(testKey, testValue, { expirationTtl: 60 }),
    );

    // 測試 GET 操作
    const getResult = await measureLatency(() => kv!.get(testKey));

    // 清理測試 key
    await kv.delete(testKey);

    // 測試 LIST 操作
    const listResult = await measureLatency(() => kv!.list({ limit: 10 }));

    // 計算總體狀態
    const allOperationsSuccess =
      setResult.success && getResult.success && listResult.success;
    const avgLatency =
      (setResult.latency + getResult.latency + listResult.latency) / 3;

    let status: "healthy" | "degraded" | "unhealthy";
    let recommendation: string;

    if (!allOperationsSuccess) {
      status = "unhealthy";
      recommendation = "KV 操作失敗，請檢查 Cloudflare KV binding 配置";
    } else if (avgLatency > 500) {
      status = "degraded";
      recommendation = `平均延遲過高 (${Math.round(avgLatency)}ms)，可能是暫時性問題`;
    } else if (avgLatency > 200) {
      status = "degraded";
      recommendation = `延遲略高 (${Math.round(avgLatency)}ms)，但在可接受範圍內`;
    } else {
      status = "healthy";
      recommendation = "Cloudflare KV 運作正常，延遲良好";
    }

    // 取得執行時期統計（來自應用程式的操作記錄）
    const runtimeStats = getRedisStats();

    return NextResponse.json({
      status,
      provider: "cloudflare-kv",
      timestamp: new Date().toISOString(),
      operations: {
        put: {
          latency: setResult.latency,
          success: setResult.success,
          error: setResult.error,
        },
        get: {
          latency: getResult.latency,
          success: getResult.success,
          error: getResult.error,
          valueMatch: getResult.result === testValue,
        },
        list: {
          latency: listResult.latency,
          success: listResult.success,
          error: listResult.error,
        },
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
        provider: "cloudflare-kv",
        connectionType: "KV Binding (native)",
        note: "Cloudflare KV 使用原生 binding，無連線管理問題",
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({
      status: "unhealthy",
      provider: "cloudflare-kv",
      timestamp: new Date().toISOString(),
      error: errorMessage,
      diagnosis: "KV 操作失敗 - 請檢查 wrangler.jsonc 中的 kv_namespaces 配置",
      recommendation: "請確認 CACHE_KV binding 已正確建立",
    });
  }
}
