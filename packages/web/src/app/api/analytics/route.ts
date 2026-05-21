import { NextRequest, NextResponse } from "next/server";
import {
  internalError,
  notFound,
  quotaExceeded,
  validationError,
} from "@/lib/api/response-helpers";
import { withRouteAuth } from "@/lib/api/route-auth";
import type { Database } from "@/types/database.types";

type AnalyticsSource = "ga4" | "gsc" | "social" | "wordpress";
type SourceFilter = AnalyticsSource | "all";
type PlanSlug = "solo" | "pro" | string;

type ArticlePerformanceRow =
  Database["public"]["Tables"]["article_performance"]["Row"] & {
    generated_articles: {
      id: string;
      title: string;
      slug: string;
      brand_id: string | null;
      company_id: string | null;
    } | null;
  };

type CompanySubscriptionSelection = {
  subscription_plans:
    | {
        slug: string | null;
      }
    | Array<{
        slug: string | null;
      }>
    | null;
};

const SOURCE_FILTERS = new Set<SourceFilter>([
  "all",
  "ga4",
  "gsc",
  "social",
  "wordpress",
]);

const SOURCES: AnalyticsSource[] = ["ga4", "gsc", "social", "wordpress"];
const SOLO_MAX_DAYS = 30;

function parseDateParam(value: string | null, name: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false as const, error: `${name} must be YYYY-MM-DD` };
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return { ok: false as const, error: `${name} is invalid` };
  }

  return { ok: true as const, value, date };
}

function inclusiveDaySpan(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function getPlanSlug(
  subscriptionPlans: CompanySubscriptionSelection["subscription_plans"],
): PlanSlug {
  if (Array.isArray(subscriptionPlans)) {
    return subscriptionPlans[0]?.slug ?? "solo";
  }

  return subscriptionPlans?.slug ?? "solo";
}

async function resolvePlanSlug(
  supabase: { from(table: string): unknown },
  companyId: string,
) {
  const { data, error } = await (
    supabase.from("company_subscriptions") as {
      select(columns: string): {
        eq(
          column: string,
          value: unknown,
        ): {
          eq(
            column: string,
            value: unknown,
          ): {
            maybeSingle(): Promise<{
              data: CompanySubscriptionSelection | null;
              error: { message?: string } | null;
            }>;
          };
        };
      };
    }
  )
    .select("subscription_plans(slug)")
    .eq("company_id", companyId)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    console.warn("[Analytics] Failed to resolve subscription plan:", error);
  }

  return data ? getPlanSlug(data.subscription_plans) : "solo";
}

function emptySourceMetrics() {
  return {
    pageviews: 0,
    sessions: 0,
    engagement: 0,
  };
}

type MutableSeriesPoint = {
  date: string;
  counts: Partial<Record<AnalyticsSource, number>>;
} & Record<AnalyticsSource, ReturnType<typeof emptySourceMetrics>>;

type ArticleAggregate = {
  articleId: string;
  title: string;
  slug: string;
  source: AnalyticsSource;
  pageviews: number;
  uniqueVisitors: number;
  avgSessionTotal: number;
  avgSessionCount: number;
  ctrTotal: number;
  ctrCount: number;
  positionTotal: number;
  positionCount: number;
};

function toNumber(value: number | string | null) {
  if (value === null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildAnalyticsPayload(input: {
  rows: ArticlePerformanceRow[];
  brandId: string;
  from: string;
  to: string;
  source: SourceFilter;
  plan: PlanSlug;
  maxDays: number | null;
}) {
  const series = new Map<string, MutableSeriesPoint>();
  const articles = new Map<string, ArticleAggregate>();
  const platformViews = new Map<AnalyticsSource, number>();

  let totalPageviews = 0;
  let uniqueVisitors = 0;

  for (const row of input.rows) {
    const article = row.generated_articles;
    if (!article) continue;

    const source = row.source as AnalyticsSource;
    const pageviews = row.pageviews ?? 0;
    const rowUnique = row.unique_visitors ?? 0;
    const avgSession = toNumber(row.avg_session_seconds);
    const ctr = toNumber(row.ctr);
    const position = toNumber(row.position);

    totalPageviews += pageviews;
    uniqueVisitors += rowUnique;
    platformViews.set(source, (platformViews.get(source) ?? 0) + pageviews);

    const point =
      series.get(row.date) ??
      ({
        date: row.date,
        counts: {},
        ga4: emptySourceMetrics(),
        gsc: emptySourceMetrics(),
        social: emptySourceMetrics(),
        wordpress: emptySourceMetrics(),
      } satisfies MutableSeriesPoint);
    point[source].pageviews += pageviews;
    point[source].sessions += rowUnique;
    if (avgSession !== null) {
      point[source].engagement += avgSession;
      point.counts[source] = (point.counts[source] ?? 0) + 1;
    }
    series.set(row.date, point);

    const articleKey = `${article.id}:${source}`;
    const aggregate =
      articles.get(articleKey) ??
      ({
        articleId: article.id,
        title: article.title,
        slug: article.slug,
        source,
        pageviews: 0,
        uniqueVisitors: 0,
        avgSessionTotal: 0,
        avgSessionCount: 0,
        ctrTotal: 0,
        ctrCount: 0,
        positionTotal: 0,
        positionCount: 0,
      } satisfies ArticleAggregate);

    aggregate.pageviews += pageviews;
    aggregate.uniqueVisitors += rowUnique;
    if (avgSession !== null) {
      aggregate.avgSessionTotal += avgSession;
      aggregate.avgSessionCount += 1;
    }
    if (ctr !== null) {
      aggregate.ctrTotal += ctr;
      aggregate.ctrCount += 1;
    }
    if (position !== null) {
      aggregate.positionTotal += position;
      aggregate.positionCount += 1;
    }
    articles.set(articleKey, aggregate);
  }

  const articleRows = Array.from(articles.values())
    .map((article) => ({
      articleId: article.articleId,
      title: article.title,
      slug: article.slug,
      source: article.source,
      pageviews: article.pageviews,
      uniqueVisitors: article.uniqueVisitors,
      avgSessionSeconds:
        article.avgSessionCount > 0
          ? article.avgSessionTotal / article.avgSessionCount
          : null,
      ctr: article.ctrCount > 0 ? article.ctrTotal / article.ctrCount : null,
      position:
        article.positionCount > 0
          ? article.positionTotal / article.positionCount
          : null,
    }))
    .sort((a, b) => b.pageviews - a.pageviews);

  const topArticle = articleRows[0]
    ? {
        articleId: articleRows[0].articleId,
        title: articleRows[0].title,
        views: articleRows[0].pageviews,
      }
    : null;

  const topPlatformEntry = Array.from(platformViews.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const timeseries = Array.from(series.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => {
      const normalized = {
        date: point.date,
        ga4: point.ga4,
        gsc: point.gsc,
        social: point.social,
        wordpress: point.wordpress,
      };

      for (const source of SOURCES) {
        const count = point.counts[source] ?? 0;
        normalized[source].engagement =
          count > 0 ? normalized[source].engagement / count : 0;
      }

      return normalized;
    });

  return {
    meta: {
      brandId: input.brandId,
      from: input.from,
      to: input.to,
      source: input.source,
      plan: input.plan,
      maxDays: input.maxDays,
    },
    kpis: {
      totalPageviews,
      uniqueVisitors,
      topArticle,
      topPlatform: topPlatformEntry
        ? {
            source: topPlatformEntry[0],
            views: topPlatformEntry[1],
          }
        : null,
    },
    timeseries,
    articles: articleRows,
  };
}

export const GET = withRouteAuth(
  "company",
  async (request: NextRequest, { supabase, companyId }) => {
    try {
      const params = new URL(request.url).searchParams;
      const brandId = params.get("brandId");
      const fromParam = parseDateParam(params.get("from"), "from");
      const toParam = parseDateParam(params.get("to"), "to");
      const source = (params.get("source") ?? "all") as SourceFilter;

      if (!brandId) {
        return validationError("brandId is required");
      }
      if (!fromParam.ok) {
        return validationError(fromParam.error);
      }
      if (!toParam.ok) {
        return validationError(toParam.error);
      }
      if (toParam.date < fromParam.date) {
        return validationError("to must be on or after from");
      }
      if (!SOURCE_FILTERS.has(source)) {
        return validationError("source is invalid");
      }

      const plan = await resolvePlanSlug(supabase, companyId);
      const days = inclusiveDaySpan(fromParam.date, toParam.date);
      const maxDays = plan === "solo" ? SOLO_MAX_DAYS : null;

      if (maxDays !== null && days > maxDays) {
        return quotaExceeded("Solo plan is limited to a 30-day analytics view");
      }

      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("id", brandId)
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .maybeSingle();

      if (brandError) {
        console.error("[Analytics] Brand lookup failed:", brandError);
        return internalError("Failed to resolve brand");
      }
      if (!brand) {
        return notFound("Brand");
      }

      let query = supabase
        .from("article_performance")
        .select(
          [
            "article_id",
            "date",
            "source",
            "pageviews",
            "unique_visitors",
            "avg_session_seconds",
            "ctr",
            "position",
            "generated_articles!inner(id,title,slug,brand_id,company_id)",
          ].join(","),
        )
        .gte("date", fromParam.value)
        .lte("date", toParam.value)
        .eq("generated_articles.brand_id", brandId)
        .eq("generated_articles.company_id", companyId)
        .order("date", { ascending: true });

      if (source !== "all") {
        query = query.eq("source", source);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[Analytics] Performance query failed:", error);
        return internalError("Failed to load analytics");
      }

      return NextResponse.json(
        buildAnalyticsPayload({
          rows: (data ?? []) as unknown[] as ArticlePerformanceRow[],
          brandId,
          from: fromParam.value,
          to: toParam.value,
          source,
          plan,
          maxDays,
        }),
      );
    } catch (error) {
      console.error("[Analytics] Fatal error:", error);
      return internalError("Failed to load analytics");
    }
  },
);
