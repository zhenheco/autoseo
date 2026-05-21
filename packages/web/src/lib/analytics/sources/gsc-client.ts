import type { AnalyticsArticle } from "./ga4-client";

export type GSCArticleQueryRow = {
  articleId: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rawMetadata?: Record<string, unknown>;
};

export interface GSCClient {
  fetchArticleQueries(input: {
    date: Date;
    articles: AnalyticsArticle[];
  }): Promise<GSCArticleQueryRow[]>;
}

type FetchLike = typeof fetch;

type GSCPerformanceRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type GSCPerformanceResponse = {
  rows?: GSCPerformanceRow[];
};

export type HttpGSCAnalyticsClientConfig = {
  accessToken: string;
  siteUrl?: string;
  endpoint?: string;
  fetchImpl?: FetchLike;
  rowLimit?: number;
  timeoutMs?: number;
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
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

function samePage(gscPage: string | undefined, articleUrl: string | null) {
  return normalizeUrl(gscPage) === normalizeUrl(articleUrl);
}

function addTimeout(init: RequestInit, timeoutMs: number): RequestInit {
  if (init.signal || timeoutMs <= 0) return init;
  return {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  };
}

export class HttpGSCAnalyticsClient implements GSCClient {
  private readonly accessToken: string;
  private readonly siteUrl?: string;
  private readonly endpoint: string;
  private readonly fetchImpl: FetchLike;
  private readonly rowLimit: number;
  private readonly timeoutMs: number;

  constructor(config: HttpGSCAnalyticsClientConfig) {
    this.accessToken = config.accessToken;
    this.siteUrl = config.siteUrl;
    this.endpoint = trimEndpoint(
      config.endpoint ?? "https://www.googleapis.com/webmasters/v3",
    );
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.rowLimit = config.rowLimit ?? 25000;
    this.timeoutMs = config.timeoutMs ?? 20_000;
  }

  async fetchArticleQueries(input: {
    date: Date;
    articles: AnalyticsArticle[];
  }): Promise<GSCArticleQueryRow[]> {
    if (!this.accessToken || input.articles.length === 0) {
      return [];
    }

    const articlesBySite = new Map<string, AnalyticsArticle[]>();
    for (const article of input.articles) {
      const siteUrl = article.gscSiteUrl ?? this.siteUrl;
      if (!siteUrl) continue;
      articlesBySite.set(siteUrl, [
        ...(articlesBySite.get(siteUrl) ?? []),
        article,
      ]);
    }

    const results: GSCArticleQueryRow[] = [];
    for (const [siteUrl, articles] of articlesBySite) {
      results.push(
        ...(await this.fetchSiteQueries(siteUrl, input.date, articles)),
      );
    }

    return results;
  }

  private async fetchSiteQueries(
    siteUrl: string,
    date: Date,
    articles: AnalyticsArticle[],
  ): Promise<GSCArticleQueryRow[]> {
    const response = await this.fetchImpl(
      `${this.endpoint}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      addTimeout(
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            startDate: dateOnly(date),
            endDate: dateOnly(date),
            dimensions: ["page", "query"],
            type: "web",
            rowLimit: this.rowLimit,
          }),
        },
        this.timeoutMs,
      ),
    );

    if (!response.ok) {
      throw new Error(`GSC article queries request failed: ${response.status}`);
    }

    const data = (await response.json()) as GSCPerformanceResponse;
    const rows = data.rows ?? [];

    return articles.flatMap((article) =>
      rows.flatMap((row) => {
        const [page, query] = row.keys ?? [];
        if (!query || !samePage(page, article.url)) return [];

        return [
          {
            articleId: article.id,
            query,
            clicks: row.clicks ?? 0,
            impressions: row.impressions ?? 0,
            ctr: row.ctr ?? 0,
            position: row.position ?? 0,
            rawMetadata: {
              page,
              siteUrl,
            },
          },
        ];
      }),
    );
  }
}
