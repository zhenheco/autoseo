"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownUp,
  BarChart3,
  ExternalLink,
  FileText,
  Globe2,
  Users,
} from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BrandSwitcher } from "@/components/ui/brand-switcher";
import { Button } from "@shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@shared/ui/card";
import { cn } from "@/lib/utils";

type AnalyticsSource = "ga4" | "gsc" | "social" | "wordpress";
type SourceFilter = "all" | AnalyticsSource;
type MetricKey = "pageviews" | "sessions" | "engagement";
type DatePreset = "7d" | "30d" | "90d" | "custom";
type SortKey =
  | "title"
  | "source"
  | "pageviews"
  | "uniqueVisitors"
  | "avgSessionSeconds"
  | "ctr"
  | "position";

type SortState = {
  key: SortKey;
  direction: "asc" | "desc";
};

type AnalyticsPayload = {
  meta: {
    brandId: string;
    from: string;
    to: string;
    source: SourceFilter;
    plan: string;
    maxDays: number | null;
  };
  kpis: {
    totalPageviews: number;
    uniqueVisitors: number;
    topArticle: { articleId: string; title: string; views: number } | null;
    topPlatform: { source: AnalyticsSource; views: number } | null;
  };
  timeseries: Array<
    {
      date: string;
    } & Record<
      AnalyticsSource,
      { pageviews: number; sessions: number; engagement: number }
    >
  >;
  articles: Array<{
    articleId: string;
    title: string;
    slug: string;
    source: AnalyticsSource;
    pageviews: number;
    uniqueVisitors: number;
    avgSessionSeconds: number | null;
    ctr: number | null;
    position: number | null;
  }>;
};

export interface AnalyticsClientProps {
  brands: { id: string; name: string }[];
  activeBrandId: string;
  initialPlan: string;
}

const SOURCE_LABELS: Record<AnalyticsSource, string> = {
  ga4: "GA4",
  gsc: "GSC",
  social: "Social",
  wordpress: "WordPress",
};

const SOURCE_COLORS: Record<AnalyticsSource, string> = {
  ga4: "#2563eb",
  gsc: "#059669",
  social: "#d97706",
  wordpress: "#7c3aed",
};

const PAGE_SIZE = 10;

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(daysBack: number, base = new Date()) {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() - daysBack);
  return next.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Exclude<DatePreset, "custom">) {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return {
    from: shiftDate(days - 1),
    to: todayString(),
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDuration(seconds: number | null) {
  if (seconds === null) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

function formatPercent(value: number | null) {
  if (value === null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatPosition(value: number | null) {
  return value === null ? "-" : value.toFixed(1);
}

function isSoloPlan(plan: string) {
  return plan === "solo";
}

function compareValues(
  left: string | number | null,
  right: string | number | null,
) {
  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }

  return (left ?? -Infinity) > (right ?? -Infinity) ? 1 : -1;
}

export function AnalyticsClient({
  brands,
  activeBrandId,
  initialPlan,
}: AnalyticsClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [range, setRange] = useState(rangeForPreset("30d"));
  const [source, setSource] = useState<SourceFilter>("all");
  const [metric, setMetric] = useState<MetricKey>("pageviews");
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sort, setSort] = useState<SortState>({
    key: "pageviews",
    direction: "desc",
  });
  const [page, setPage] = useState(1);

  const activePlan = data?.meta.plan ?? initialPlan;
  const solo = isSoloPlan(activePlan);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      brandId: activeBrandId,
      from: range.from,
      to: range.to,
      source,
    });

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setIsLoading(true);
        setError(null);
      }
    });

    fetch(`/api/analytics?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "Failed to load analytics");
        }
        return body as AnalyticsPayload;
      })
      .then((payload) => {
        setData(payload);
        setPage(1);
      })
      .catch((fetchError) => {
        if ((fetchError as Error).name === "AbortError") return;
        setError((fetchError as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeBrandId, range.from, range.to, source]);

  const chartRows = useMemo(() => {
    return (data?.timeseries ?? []).map((point) => ({
      date: point.date.slice(5),
      ga4: point.ga4[metric],
      gsc: point.gsc[metric],
      social: point.social[metric],
      wordpress: point.wordpress?.[metric] ?? 0,
    }));
  }, [data?.timeseries, metric]);

  const sortedArticles = useMemo(() => {
    const rows = [...(data?.articles ?? [])];
    rows.sort((left, right) => {
      const result = compareValues(left[sort.key], right[sort.key]);
      return sort.direction === "asc" ? result : -result;
    });
    return rows;
  }, [data?.articles, sort]);

  const pagedArticles = sortedArticles.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );
  const totalPages = Math.max(1, Math.ceil(sortedArticles.length / PAGE_SIZE));

  function applyPreset(nextPreset: DatePreset) {
    if (nextPreset === "90d" && solo) return;
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      setRange(rangeForPreset(nextPreset));
    }
  }

  function updateSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function switchBrand(nextBrandId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("brand", nextBrandId);
    router.push(`${pathname}?${params.toString()}`);
    router.refresh();
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Per-brand article performance across search, web, and social
            sources.
          </p>
        </div>
        <BrandSwitcher
          brands={brands}
          activeBrandId={activeBrandId}
          onSwitch={switchBrand}
          className="static z-auto border-0 bg-transparent p-0"
        />
      </div>

      <Card className="rounded-lg border-border/60 shadow-sm">
        <CardContent className="grid gap-4 p-4 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              Date range
            </label>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-md bg-muted p-1">
              {(["7d", "30d", "90d", "custom"] as DatePreset[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "h-9 rounded px-2 text-xs font-medium transition-colors",
                    preset === item
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    item === "90d" && solo && "cursor-not-allowed opacity-40",
                  )}
                  disabled={item === "90d" && solo}
                  onClick={() => applyPreset(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label className="text-xs font-medium text-muted-foreground">
            Platform
            <select
              aria-label="Platform"
              value={source}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              onChange={(event) =>
                setSource(event.target.value as SourceFilter)
              }
            >
              <option value="all">All platforms</option>
              <option value="ga4">GA4</option>
              <option value="gsc">GSC</option>
              <option value="social">Social</option>
            </select>
          </label>

          <label className="text-xs font-medium text-muted-foreground">
            Metric
            <select
              aria-label="Metric"
              value={metric}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              onChange={(event) => setMetric(event.target.value as MetricKey)}
            >
              <option value="pageviews">Pageviews</option>
              <option value="sessions">Sessions</option>
              <option value="engagement">Engagement</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-muted-foreground">
              From
              <input
                aria-label="From"
                type="date"
                value={range.from}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                onChange={(event) => {
                  setPreset("custom");
                  setRange((current) => ({
                    ...current,
                    from: event.target.value,
                  }));
                }}
              />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              To
              <input
                aria-label="To"
                type="date"
                value={range.to}
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                onChange={(event) => {
                  setPreset("custom");
                  setRange((current) => ({
                    ...current,
                    to: event.target.value,
                  }));
                }}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {solo && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Solo analytics is limited to the latest 30 days. Upgrade to Pro for
          longer history and per-article deep links.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total pageviews"
          value={kpis ? formatNumber(kpis.totalPageviews) : "-"}
          icon={<BarChart3 className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Unique visitors"
          value={kpis ? formatNumber(kpis.uniqueVisitors) : "-"}
          icon={<Users className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Top article"
          value={kpis?.topArticle?.title ?? "-"}
          detail={
            kpis?.topArticle
              ? `${formatNumber(kpis.topArticle.views)} views`
              : ""
          }
          icon={<FileText className="h-4 w-4" />}
          loading={isLoading}
        />
        <KpiCard
          title="Top platform"
          value={
            kpis?.topPlatform ? SOURCE_LABELS[kpis.topPlatform.source] : "-"
          }
          detail={
            kpis?.topPlatform
              ? `${formatNumber(kpis.topPlatform.views)} views`
              : ""
          }
          icon={<Globe2 className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      <Card className="rounded-lg border-border/60 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Source trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                {(["ga4", "gsc", "social", "wordpress"] as AnalyticsSource[])
                  .filter((item) => source === "all" || source === item)
                  .map((item) => (
                    <Line
                      key={item}
                      type="monotone"
                      dataKey={item}
                      name={SOURCE_LABELS[item]}
                      stroke={SOURCE_COLORS[item]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Article performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <SortableHeader
                    label="Article title"
                    sortKey="title"
                    onSort={updateSort}
                  />
                  <SortableHeader
                    label="Source"
                    sortKey="source"
                    onSort={updateSort}
                  />
                  <SortableHeader
                    label="Pageviews"
                    sortKey="pageviews"
                    onSort={updateSort}
                  />
                  <SortableHeader
                    label="Unique"
                    sortKey="uniqueVisitors"
                    onSort={updateSort}
                  />
                  <SortableHeader
                    label="Session avg"
                    sortKey="avgSessionSeconds"
                    onSort={updateSort}
                  />
                  <SortableHeader
                    label="CTR"
                    sortKey="ctr"
                    onSort={updateSort}
                  />
                  <SortableHeader
                    label="Position"
                    sortKey="position"
                    onSort={updateSort}
                  />
                </tr>
              </thead>
              <tbody>
                {pagedArticles.map((article) => (
                  <tr
                    key={`${article.articleId}:${article.source}`}
                    className="border-b last:border-0"
                  >
                    <td className="max-w-[320px] py-3 pr-4 font-medium text-foreground">
                      {solo ? (
                        <span className="line-clamp-1">{article.title}</span>
                      ) : (
                        <Link
                          href={`/dashboard/articles/manage?article=${article.articleId}`}
                          className="inline-flex max-w-full items-center gap-1 text-primary hover:underline"
                        >
                          <span className="truncate">{article.title}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </Link>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {SOURCE_LABELS[article.source]}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatNumber(article.pageviews)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatNumber(article.uniqueVisitors)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatDuration(article.avgSessionSeconds)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatPercent(article.ctr)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatPosition(article.position)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagedArticles.length === 0 && !isLoading && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No analytics data for this filter.
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  value,
  detail,
  icon,
  loading,
}: {
  title: string;
  value: string;
  detail?: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="rounded-lg border-border/60 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            {icon}
          </div>
        </div>
        <div
          className={cn(
            "mt-3 min-h-8 text-2xl font-semibold tracking-tight text-foreground",
            loading && "animate-pulse text-muted-foreground",
          )}
        >
          {loading ? "Loading" : value}
        </div>
        {detail && (
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SortableHeader({
  label,
  sortKey,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  onSort(key: SortKey): void;
}) {
  return (
    <th className="py-3 pr-4 font-medium">
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <ArrowDownUp className="h-3 w-3" />
      </button>
    </th>
  );
}
