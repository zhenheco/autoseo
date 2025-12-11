"use client";

import { useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GoogleConnectButton } from "./GoogleConnectButton";
import {
  RefreshCw,
  Search,
  BarChart3,
  TrendingUp,
  Eye,
  MousePointer,
  ArrowUpDown,
} from "lucide-react";
import useSWR from "swr";
import type {
  GSCPerformanceSummary,
  WebsiteOAuthStatus,
} from "@/types/google-analytics.types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AnalyticsDashboardProps {
  websiteId: string;
}

/**
 * 分析儀表板
 * 顯示 GSC 搜尋數據
 */
export function AnalyticsDashboard({ websiteId }: AnalyticsDashboardProps) {
  // 取得 OAuth 連接狀態
  const {
    data: oauthStatus,
    mutate: mutateOAuthStatus,
    isLoading: isLoadingStatus,
  } = useSWR<WebsiteOAuthStatus>(
    `/api/websites/${websiteId}/oauth-status`,
    fetcher,
    { revalidateOnFocus: false },
  );

  // GSC 數據
  const {
    data: gscData,
    isLoading: isLoadingGsc,
    mutate: mutateGsc,
  } = useSWR<GSCPerformanceSummary & { success: boolean; error?: string }>(
    oauthStatus?.gsc_connected
      ? `/api/analytics/gsc/performance?website_id=${websiteId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // 刷新數據
  const handleRefresh = useCallback(() => {
    mutateGsc();
  }, [mutateGsc]);

  // 斷開連接後刷新狀態
  const handleDisconnect = useCallback(() => {
    mutateOAuthStatus();
    mutateGsc();
  }, [mutateOAuthStatus, mutateGsc]);

  if (isLoadingStatus) {
    return <AnalyticsDashboardSkeleton />;
  }

  const gscConnected = oauthStatus?.gsc_connected ?? false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Console 數據
          </CardTitle>
          <div className="flex items-center gap-2">
            {gscConnected && (
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <GoogleConnectButton
              websiteId={websiteId}
              serviceType="gsc"
              isConnected={gscConnected}
              connectedEmail={oauthStatus?.gsc_email}
              onDisconnect={handleDisconnect}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {gscConnected ? (
          isLoadingGsc ? (
            <MetricsSkeleton />
          ) : gscData?.success ? (
            <GSCMetricsDisplay data={gscData} />
          ) : (
            <ErrorDisplay message={gscData?.error || "無法載入數據"} />
          )
        ) : (
          <EmptyState
            icon={Search}
            title="尚未連接 Search Console"
            description="連接 Google Search Console 以查看網站在搜尋引擎中的表現"
          />
        )}
      </CardContent>
    </Card>
  );
}

// GSC 指標顯示
function GSCMetricsDisplay({ data }: { data: GSCPerformanceSummary }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <MetricCard
        icon={MousePointer}
        label="總點擊數"
        value={data.totalClicks.toLocaleString()}
        iconColor="text-blue-500"
      />
      <MetricCard
        icon={Eye}
        label="總曝光數"
        value={data.totalImpressions.toLocaleString()}
        iconColor="text-green-500"
      />
      <MetricCard
        icon={TrendingUp}
        label="平均 CTR"
        value={`${(data.avgCtr * 100).toFixed(2)}%`}
        iconColor="text-orange-500"
      />
      <MetricCard
        icon={ArrowUpDown}
        label="平均排名"
        value={data.avgPosition.toFixed(1)}
        iconColor="text-purple-500"
      />
    </div>
  );
}

// 指標卡片
interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor?: string;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  iconColor = "text-primary",
}: MetricCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

// 空狀態
interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}

// 錯誤顯示
function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <BarChart3 className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="font-semibold mb-1">載入失敗</h3>
      <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    </div>
  );
}

// 載入骨架
function AnalyticsDashboardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <MetricsSkeleton />
      </CardContent>
    </Card>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border p-4">
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}
