"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  GA4TrafficSummary,
  WebsiteOAuthStatus,
} from "@/types/google-analytics.types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AnalyticsDashboardProps {
  websiteId: string;
}

/**
 * 分析儀表板
 * 顯示 GSC 和 GA4 數據
 */
export function AnalyticsDashboard({ websiteId }: AnalyticsDashboardProps) {
  const [activeTab, setActiveTab] = useState<"gsc" | "ga4">("gsc");

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

  // GA4 數據
  const {
    data: ga4Data,
    isLoading: isLoadingGa4,
    mutate: mutateGa4,
  } = useSWR<GA4TrafficSummary & { success: boolean; error?: string }>(
    oauthStatus?.ga4_connected
      ? `/api/analytics/ga4/traffic?website_id=${websiteId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  // 刷新數據
  const handleRefresh = useCallback(() => {
    if (activeTab === "gsc") {
      mutateGsc();
    } else {
      mutateGa4();
    }
  }, [activeTab, mutateGsc, mutateGa4]);

  // 斷開連接後刷新狀態
  const handleDisconnect = useCallback(() => {
    mutateOAuthStatus();
    if (activeTab === "gsc") {
      mutateGsc();
    } else {
      mutateGa4();
    }
  }, [activeTab, mutateOAuthStatus, mutateGsc, mutateGa4]);

  if (isLoadingStatus) {
    return <AnalyticsDashboardSkeleton />;
  }

  const gscConnected = oauthStatus?.gsc_connected ?? false;
  const ga4Connected = oauthStatus?.ga4_connected ?? false;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            網站分析
          </CardTitle>
          <div className="flex items-center gap-2">
            {(gscConnected || ga4Connected) && (
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "gsc" | "ga4")}
        >
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="gsc" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Search Console</span>
                <span className="sm:hidden">GSC</span>
              </TabsTrigger>
              <TabsTrigger value="ga4" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">GA4</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              {activeTab === "gsc" && (
                <GoogleConnectButton
                  websiteId={websiteId}
                  serviceType="gsc"
                  isConnected={gscConnected}
                  connectedEmail={oauthStatus?.gsc_email}
                  onDisconnect={handleDisconnect}
                  size="sm"
                />
              )}
              {activeTab === "ga4" && (
                <GoogleConnectButton
                  websiteId={websiteId}
                  serviceType="ga4"
                  isConnected={ga4Connected}
                  connectedEmail={oauthStatus?.ga4_email}
                  onDisconnect={handleDisconnect}
                  size="sm"
                />
              )}
            </div>
          </div>

          {/* GSC Tab */}
          <TabsContent value="gsc" className="mt-0">
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
          </TabsContent>

          {/* GA4 Tab */}
          <TabsContent value="ga4" className="mt-0">
            {ga4Connected ? (
              isLoadingGa4 ? (
                <MetricsSkeleton />
              ) : ga4Data?.success ? (
                <GA4MetricsDisplay data={ga4Data} />
              ) : (
                <ErrorDisplay message={ga4Data?.error || "無法載入數據"} />
              )
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="尚未連接 Analytics"
                description="連接 Google Analytics 4 以查看網站流量分析"
              />
            )}
          </TabsContent>
        </Tabs>
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

// GA4 指標顯示
function GA4MetricsDisplay({ data }: { data: GA4TrafficSummary }) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      <MetricCard
        icon={Eye}
        label="總瀏覽量"
        value={data.totalPageviews.toLocaleString()}
        iconColor="text-blue-500"
      />
      <MetricCard
        icon={MousePointer}
        label="總工作階段"
        value={data.totalSessions.toLocaleString()}
        iconColor="text-green-500"
      />
      <MetricCard
        icon={TrendingUp}
        label="總使用者"
        value={data.totalUsers.toLocaleString()}
        iconColor="text-orange-500"
      />
      <MetricCard
        icon={ArrowUpDown}
        label="跳出率"
        value={`${(data.avgBounceRate * 100).toFixed(1)}%`}
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
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-64 mb-4" />
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
