"use client";

import { ScoreCard } from "./score-card";
import { CoreWebVitalsDisplay } from "./core-web-vitals-display";
import { MetaAnalysisDisplay } from "./meta-analysis-display";
import { RecommendationsList } from "./recommendations-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { HealthCheckResult } from "@/types/health-check";
import {
  Zap,
  Accessibility,
  Search,
  Shield,
  FileText,
  Map,
  CheckCircle,
  XCircle,
  Monitor,
  Smartphone,
  Clock,
  Globe,
} from "lucide-react";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";

interface HealthCheckResultsProps {
  result: HealthCheckResult;
}

/**
 * 健康檢查結果主元件
 * 整合所有子元件顯示完整的健檢報告
 */
export function HealthCheckResults({ result }: HealthCheckResultsProps) {
  return (
    <div className="space-y-6">
      {/* 檢查資訊 */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Globe className="h-4 w-4" />
          <span className="truncate max-w-[300px]">{result.urlChecked}</span>
        </div>
        <div className="flex items-center gap-1">
          {result.deviceType === "mobile" ? (
            <Smartphone className="h-4 w-4" />
          ) : (
            <Monitor className="h-4 w-4" />
          )}
          <span>{result.deviceType === "mobile" ? "行動版" : "桌面版"}</span>
        </div>
        {result.completedAt && (
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>
              {format(new Date(result.completedAt), "yyyy/MM/dd HH:mm", {
                locale: zhTW,
              })}
            </span>
          </div>
        )}
      </div>

      {/* Lighthouse 分數卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreCard
          title="效能"
          score={result.scores.performance}
          icon={<Zap className="h-5 w-5" />}
          description="網頁載入和回應速度"
        />
        <ScoreCard
          title="無障礙"
          score={result.scores.accessibility}
          icon={<Accessibility className="h-5 w-5" />}
          description="對輔助技術的支援程度"
        />
        <ScoreCard
          title="SEO"
          score={result.scores.seo}
          icon={<Search className="h-5 w-5" />}
          description="搜尋引擎優化程度"
        />
        <ScoreCard
          title="最佳實踐"
          score={result.scores.bestPractices}
          icon={<Shield className="h-5 w-5" />}
          description="現代網頁開發標準"
        />
      </div>

      {/* Core Web Vitals */}
      <CoreWebVitalsDisplay vitals={result.coreWebVitals} />

      {/* 基礎 SEO 檢查 */}
      <Card>
        <CardHeader>
          <CardTitle>基礎 SEO 檢查</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* robots.txt */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">robots.txt</span>
                </div>
                {result.basicSeo.robotsTxt.exists ? (
                  <Badge
                    variant="outline"
                    className="bg-green-500/10 text-green-600"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    存在
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-red-500/10 text-red-600"
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    缺少
                  </Badge>
                )}
              </div>
              {result.basicSeo.robotsTxt.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.basicSeo.robotsTxt.issues.map((issue, idx) => (
                    <li key={idx} className="text-sm text-yellow-600">
                      • {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Sitemap */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Map className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">Sitemap</span>
                </div>
                {result.basicSeo.sitemap.exists ? (
                  <Badge
                    variant="outline"
                    className="bg-green-500/10 text-green-600"
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    存在
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-red-500/10 text-red-600"
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    缺少
                  </Badge>
                )}
              </div>
              {result.basicSeo.sitemap.url && (
                <p className="mt-2 text-sm text-muted-foreground truncate">
                  {result.basicSeo.sitemap.url}
                </p>
              )}
              {result.basicSeo.sitemap.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {result.basicSeo.sitemap.issues.map((issue, idx) => (
                    <li key={idx} className="text-sm text-yellow-600">
                      • {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 結構化資料 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>結構化資料 (JSON-LD)</CardTitle>
            {result.structuredData.hasJsonLd ? (
              <Badge
                variant="outline"
                className="bg-green-500/10 text-green-600"
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                已設定
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/10 text-red-600">
                <XCircle className="mr-1 h-3 w-3" />
                未設定
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {result.structuredData.hasJsonLd ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                發現的 Schema 類型:
              </p>
              <div className="flex flex-wrap gap-2">
                {result.structuredData.typesFound.map((type) => (
                  <Badge key={type} variant="outline">
                    {type}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              建議加入 JSON-LD 結構化資料以提升搜尋結果的豐富程度。
            </p>
          )}
          {result.structuredData.issues.length > 0 && (
            <ul className="mt-3 space-y-1">
              {result.structuredData.issues.map((issue, idx) => (
                <li key={idx} className="text-sm text-yellow-600">
                  • {issue}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Meta 標籤分析 */}
      <MetaAnalysisDisplay analysis={result.metaAnalysis} />

      {/* AI 改善建議 */}
      <RecommendationsList recommendations={result.recommendations} />
    </div>
  );
}
