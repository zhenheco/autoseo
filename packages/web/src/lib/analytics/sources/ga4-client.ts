export type AnalyticsArticle = {
  id: string;
  brandId: string | null;
  url: string | null;
  slug?: string | null;
  websiteId?: string | null;
  ga4PropertyId?: string | null;
  gscSiteUrl?: string | null;
};

export type GA4ArticleMetricRow = {
  articleId: string;
  pageviews: number;
  sessions: number;
  conversions: number;
  avgSessionSeconds: number | null;
  rawMetadata?: Record<string, unknown>;
};

export interface GA4Client {
  fetchArticleMetrics(input: {
    date: Date;
    articles: AnalyticsArticle[];
  }): Promise<GA4ArticleMetricRow[]>;
}

type FetchLike = typeof fetch;

type GA4RunReportResponse = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

export type HttpGA4ClientConfig = {
  accessToken: string;
  propertyId?: string;
  endpoint?: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
  } catch {
    return value.split("?")[0]?.replace(/\/+$/, "") ?? null;
  }
}

function matchesArticleUrl(pageLocation: string, articleUrl: string | null) {
  if (!articleUrl) return false;
  const normalizedPage = normalizeUrl(pageLocation);
  const normalizedArticle = normalizeUrl(articleUrl);
  return Boolean(
    normalizedPage &&
      normalizedArticle &&
      (normalizedPage === normalizedArticle ||
        normalizedPage.endsWith(normalizedArticle)),
  );
}

function addTimeout(init: RequestInit, timeoutMs: number): RequestInit {
  if (init.signal || timeoutMs <= 0) return init;
  return {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  };
}

export class HttpGA4Client implements GA4Client {
  private readonly accessToken: string;
  private readonly propertyId?: string;
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(config: HttpGA4ClientConfig) {
    this.accessToken = config.accessToken;
    this.propertyId = config.propertyId;
    this.endpoint = trimEndpoint(
      config.endpoint ?? "https://analyticsdata.googleapis.com/v1beta",
    );
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 20_000;
  }

  async fetchArticleMetrics(input: {
    date: Date;
    articles: AnalyticsArticle[];
  }): Promise<GA4ArticleMetricRow[]> {
    if (!this.accessToken || input.articles.length === 0) {
      return [];
    }

    const articlesByProperty = new Map<string, AnalyticsArticle[]>();
    for (const article of input.articles) {
      const propertyId = article.ga4PropertyId ?? this.propertyId;
      if (!propertyId) continue;
      articlesByProperty.set(propertyId, [
        ...(articlesByProperty.get(propertyId) ?? []),
        article,
      ]);
    }

    const results: GA4ArticleMetricRow[] = [];
    for (const [propertyId, articles] of articlesByProperty) {
      results.push(
        ...(await this.fetchPropertyMetrics(propertyId, input.date, articles)),
      );
    }

    return results;
  }

  private async fetchPropertyMetrics(
    propertyId: string,
    date: Date,
    articles: AnalyticsArticle[],
  ): Promise<GA4ArticleMetricRow[]> {
    const response = await this.fetchImpl(
      `${this.endpoint}/properties/${encodeURIComponent(propertyId)}:runReport`,
      addTimeout(
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            dateRanges: [
              { startDate: dateOnly(date), endDate: dateOnly(date) },
            ],
            dimensions: [{ name: "pageLocation" }],
            metrics: [
              { name: "screenPageViews" },
              { name: "sessions" },
              { name: "conversions" },
              { name: "averageSessionDuration" },
            ],
            limit: 100000,
          }),
        },
        this.timeoutMs,
      ),
    );

    if (!response.ok) {
      throw new Error(`GA4 article metrics request failed: ${response.status}`);
    }

    const data = (await response.json()) as GA4RunReportResponse;
    const rows = data.rows ?? [];

    return articles.flatMap((article) => {
      const matchedRows = rows.filter((row) =>
        matchesArticleUrl(row.dimensionValues?.[0]?.value ?? "", article.url),
      );
      if (matchedRows.length === 0) return [];

      const totals = matchedRows.reduce(
        (acc, row) => {
          const metrics = row.metricValues ?? [];
          acc.pageviews += toNumber(metrics[0]?.value);
          acc.sessions += toNumber(metrics[1]?.value);
          acc.conversions += toNumber(metrics[2]?.value);
          acc.sessionDurationTotal += toNumber(metrics[3]?.value);
          return acc;
        },
        {
          pageviews: 0,
          sessions: 0,
          conversions: 0,
          sessionDurationTotal: 0,
        },
      );

      return [
        {
          articleId: article.id,
          pageviews: totals.pageviews,
          sessions: totals.sessions,
          conversions: totals.conversions,
          avgSessionSeconds:
            matchedRows.length > 0
              ? totals.sessionDurationTotal / matchedRows.length
              : null,
          rawMetadata: {
            propertyId,
            matchedRows: matchedRows.length,
          },
        },
      ];
    });
  }
}
