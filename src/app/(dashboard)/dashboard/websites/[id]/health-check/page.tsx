"use client";

/**
 * 網站健康檢查頁面
 *
 * 使用 Client Component + 輪詢模式：
 * 1. 不阻塞 SSR
 * 2. 用戶可以看到即時進度
 * 3. 即使出錯也不影響整個網站
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Gauge,
  Search,
  Eye,
  Shield,
} from "lucide-react";
import Link from "next/link";
import type {
  HealthCheckJob,
  HealthCheckResult,
  AiRecommendation,
} from "@/types/health-check";

// 輪詢間隔（毫秒）
const POLL_INTERVAL = 3000;

// 分數顏色
function getScoreColor(score: number | null): string {
  if (score === null) return "text-gray-400";
  if (score >= 90) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

// 分數背景色
function getScoreBgColor(score: number | null): string {
  if (score === null) return "bg-gray-100";
  if (score >= 90) return "bg-green-50";
  if (score >= 50) return "bg-yellow-50";
  return "bg-red-50";
}

// 優先級顏色
function getPriorityColor(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

// 分數卡片元件
function ScoreCard({
  title,
  score,
  icon: Icon,
}: {
  title: string;
  score: number | null;
  icon: React.ElementType;
}) {
  return (
    <div className={`rounded-lg p-4 ${getScoreBgColor(score)}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-5 w-5 text-gray-600" />
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      <div className={`text-3xl font-bold ${getScoreColor(score)}`}>
        {score !== null ? score : "N/A"}
      </div>
    </div>
  );
}

// Core Web Vitals 元件
function CoreWebVitalsDisplay({ result }: { result: HealthCheckResult }) {
  const vitals = [
    {
      name: "LCP",
      value: result.lcp_ms,
      unit: "ms",
      good: 2500,
      needsImprovement: 4000,
    },
    {
      name: "INP",
      value: result.inp_ms,
      unit: "ms",
      good: 200,
      needsImprovement: 500,
    },
    {
      name: "CLS",
      value: result.cls,
      unit: "",
      good: 0.1,
      needsImprovement: 0.25,
    },
    {
      name: "FCP",
      value: result.fcp_ms,
      unit: "ms",
      good: 1800,
      needsImprovement: 3000,
    },
    {
      name: "TTFB",
      value: result.ttfb_ms,
      unit: "ms",
      good: 800,
      needsImprovement: 1800,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {vitals.map((vital) => {
        const value = vital.value;
        let status: "good" | "needs-improvement" | "poor" | "unknown" =
          "unknown";

        if (value !== null) {
          if (value <= vital.good) status = "good";
          else if (value <= vital.needsImprovement)
            status = "needs-improvement";
          else status = "poor";
        }

        const statusColors = {
          good: "bg-green-100 text-green-800",
          "needs-improvement": "bg-yellow-100 text-yellow-800",
          poor: "bg-red-100 text-red-800",
          unknown: "bg-gray-100 text-gray-600",
        };

        return (
          <div
            key={vital.name}
            className={`rounded-lg p-3 ${statusColors[status]}`}
          >
            <div className="text-xs font-medium opacity-75">{vital.name}</div>
            <div className="text-lg font-bold">
              {value !== null
                ? `${vital.unit === "ms" ? Math.round(value) : value.toFixed(2)}${vital.unit}`
                : "N/A"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// AI 建議列表元件
function RecommendationsList({
  recommendations,
}: {
  recommendations: AiRecommendation[];
}) {
  if (recommendations.length === 0) {
    return (
      <p className="text-gray-500 text-center py-4">
        目前沒有建議，您的網站表現良好！
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, index) => (
        <div
          key={index}
          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge className={getPriorityColor(rec.priority)}>
              {rec.priority === "high"
                ? "高優先"
                : rec.priority === "medium"
                  ? "中優先"
                  : "低優先"}
            </Badge>
            <Badge variant="outline">{rec.category}</Badge>
          </div>
          <h4 className="font-medium mb-1">{rec.title}</h4>
          <p className="text-sm text-gray-600">{rec.description}</p>
          {rec.estimatedImpact && (
            <p className="text-xs text-gray-500 mt-2">
              預估影響：{rec.estimatedImpact}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HealthCheckPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params.id as string;

  const [job, setJob] = useState<HealthCheckJob | null>(null);
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 取得最新狀態
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/websites/${websiteId}/health-check`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch status");
      }

      setJob(data.job);
      setResult(data.result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤");
    } finally {
      setIsLoading(false);
    }
  }, [websiteId]);

  // 開始健康檢查
  const startHealthCheck = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const response = await fetch(`/api/websites/${websiteId}/health-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start health check");
      }

      setJob(data.job);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法啟動健康檢查");
    } finally {
      setIsStarting(false);
    }
  };

  // 初始載入
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // 輪詢 pending/processing 狀態
  useEffect(() => {
    if (job && (job.status === "pending" || job.status === "processing")) {
      const interval = setInterval(fetchStatus, POLL_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [job, fetchStatus]);

  // 狀態顯示
  const renderStatus = () => {
    if (!job) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">尚未執行過健康檢查</p>
          <Button onClick={startHealthCheck} disabled={isStarting}>
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                啟動中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                執行健康檢查
              </>
            )}
          </Button>
        </div>
      );
    }

    switch (job.status) {
      case "pending":
        return (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <p className="text-lg font-medium">等待處理中...</p>
            <p className="text-gray-500 text-sm mt-2">
              系統正在排隊處理您的請求，請稍候
            </p>
          </div>
        );

      case "processing":
        return (
          <div className="text-center py-8">
            <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
            <p className="text-lg font-medium">正在分析網站...</p>
            <p className="text-gray-500 text-sm mt-2">
              這可能需要 30-60 秒，請耐心等待
            </p>
          </div>
        );

      case "failed":
        return (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-red-600">檢查失敗</p>
            <p className="text-gray-500 text-sm mt-2">
              {job.error_message || "發生未知錯誤"}
            </p>
            <Button
              onClick={startHealthCheck}
              disabled={isStarting}
              className="mt-4"
            >
              重新檢查
            </Button>
          </div>
        );

      case "completed":
        return null; // 顯示結果

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/websites/${websiteId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">網站健康檢查</h1>
        </div>
        {job?.status === "completed" && (
          <Button onClick={startHealthCheck} disabled={isStarting}>
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                啟動中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                重新檢查
              </>
            )}
          </Button>
        )}
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 狀態或結果 */}
      {job?.status !== "completed" ? (
        <Card>
          <CardContent className="pt-6">{renderStatus()}</CardContent>
        </Card>
      ) : result ? (
        <div className="space-y-6">
          {/* 完成標記 */}
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm">
              檢查完成於 {new Date(job.completed_at!).toLocaleString("zh-TW")}
            </span>
          </div>

          {/* Lighthouse 分數 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lighthouse 分數</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ScoreCard
                  title="效能"
                  score={result.performance_score}
                  icon={Gauge}
                />
                <ScoreCard title="SEO" score={result.seo_score} icon={Search} />
                <ScoreCard
                  title="無障礙"
                  score={result.accessibility_score}
                  icon={Eye}
                />
                <ScoreCard
                  title="最佳實踐"
                  score={result.best_practices_score}
                  icon={Shield}
                />
              </div>
            </CardContent>
          </Card>

          {/* Core Web Vitals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Core Web Vitals</CardTitle>
            </CardHeader>
            <CardContent>
              <CoreWebVitalsDisplay result={result} />
            </CardContent>
          </Card>

          {/* 基礎 SEO 檢查 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基礎 SEO 檢查</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {result.robots_txt_exists ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>robots.txt</span>
                </div>
                <div className="flex items-center gap-2">
                  {result.sitemap_exists ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span>Sitemap</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI 建議 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AI 改善建議</CardTitle>
            </CardHeader>
            <CardContent>
              <RecommendationsList
                recommendations={
                  (result.ai_recommendations as AiRecommendation[]) || []
                }
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
