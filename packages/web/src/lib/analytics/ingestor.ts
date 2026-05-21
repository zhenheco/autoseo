import type {
  AnalyticsArticle,
  GA4ArticleMetricRow,
  GA4Client,
} from "./sources/ga4-client";
import type { GSCArticleQueryRow, GSCClient } from "./sources/gsc-client";
import type {
  SocialEngagement,
  SocialPublisher as PublisherWithEngagement,
} from "../social/publisher";
export type { AnalyticsArticle, GA4Client, GSCClient };

export type SocialPublisher = Pick<PublisherWithEngagement, "fetchEngagement">;

export interface AnalyticsIngestor {
  ingest(date: Date, options?: { onlyBrandId?: string }): Promise<IngestReport>;
}

export interface IngestReport {
  ga4: { rows: number; errors: string[] };
  gsc: { rows: number; errors: string[] };
  social: { rows: number; errors: string[] };
}

type SupabaseResponse<T = unknown> = {
  data?: T | null;
  error?: { message?: string; code?: string } | null;
};

type SupabaseQueryBuilder = PromiseLike<SupabaseResponse<unknown>> & {
  select(columns: string): SupabaseQueryBuilder;
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  not(column: string, operator: string, value: unknown): SupabaseQueryBuilder;
  in(column: string, values: unknown[]): SupabaseQueryBuilder;
  gte(column: string, value: unknown): SupabaseQueryBuilder;
  lt(column: string, value: unknown): SupabaseQueryBuilder;
  upsert(
    values: unknown,
    options?: Record<string, unknown>,
  ): PromiseLike<SupabaseResponse<unknown>>;
};

export interface SupabaseServerClient {
  from(table: string): SupabaseQueryBuilder;
}

type ArticleRow = {
  id: string;
  brand_id: string | null;
  slug: string | null;
  wordpress_post_url: string | null;
  published_to_website_id?: string | null;
  website_id?: string | null;
};

type WebsiteRow = {
  id: string;
  wordpress_url: string | null;
  api_config: unknown;
};

type SocialPostRow = {
  id: string;
  article_id: string | null;
  platform_post_id: string | null;
};

type ArticlePerformanceInsert = {
  article_id: string;
  date: string;
  source: "ga4" | "gsc" | "social";
  pageviews: number;
  unique_visitors: number;
  avg_session_seconds: number | null;
  conversions: number;
  ctr: number | null;
  position: number | null;
  raw_metadata: unknown;
};

type SourceReport = { rows: number; errors: string[] };

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextUtcDate(date: Date): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toNumber(value: number | undefined | null): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function joinUrl(baseUrl: string | null | undefined, slug: string | null) {
  if (!baseUrl || !slug) return null;
  return `${baseUrl.replace(/\/+$/, "")}/${slug.replace(/^\/+/, "")}`;
}

function stringFromConfig(config: unknown, keys: string[]): string | undefined {
  if (!config || typeof config !== "object") return undefined;
  const record = config as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function socialNumber(
  engagement: SocialEngagement,
  keys: Array<keyof SocialEngagement>,
): number {
  for (const key of keys) {
    const value = engagement[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

async function loadWebsiteMap(
  supabase: SupabaseServerClient,
  websiteIds: string[],
): Promise<Map<string, WebsiteRow>> {
  if (websiteIds.length === 0) {
    return new Map();
  }

  const response = await supabase
    .from("website_configs")
    .select("id, wordpress_url, api_config")
    .in("id", websiteIds);

  if (response.error) {
    throw new Error(response.error.message || "Failed to load website configs");
  }

  const websites = Array.isArray(response.data)
    ? (response.data as WebsiteRow[])
    : [];

  return new Map(websites.map((website) => [website.id, website]));
}

async function loadArticles(
  supabase: SupabaseServerClient,
  options?: { onlyBrandId?: string },
): Promise<AnalyticsArticle[]> {
  let query = supabase
    .from("generated_articles")
    .select(
      "id, brand_id, slug, wordpress_post_url, published_to_website_id, website_id, published_at",
    )
    .not("published_at", "is", null);

  if (options?.onlyBrandId) {
    query = query.eq("brand_id", options.onlyBrandId);
  }

  const response = await query;
  if (response.error) {
    throw new Error(response.error.message || "Failed to load articles");
  }

  const rows = Array.isArray(response.data)
    ? (response.data as ArticleRow[])
    : [];
  const websiteIds = [
    ...new Set(
      rows.flatMap((row) => {
        const websiteId = row.published_to_website_id ?? row.website_id;
        return websiteId ? [websiteId] : [];
      }),
    ),
  ];
  const websiteMap = await loadWebsiteMap(supabase, websiteIds);

  return rows.map((row) => {
    const websiteId = row.published_to_website_id ?? row.website_id ?? null;
    const website = websiteId ? websiteMap.get(websiteId) : undefined;
    const url =
      row.wordpress_post_url || joinUrl(website?.wordpress_url, row.slug);

    return {
      id: row.id,
      brandId: row.brand_id,
      slug: row.slug,
      websiteId,
      url,
      ga4PropertyId: stringFromConfig(website?.api_config, [
        "ga4PropertyId",
        "ga4_property_id",
        "googleAnalyticsPropertyId",
      ]),
      gscSiteUrl:
        stringFromConfig(website?.api_config, [
          "gscSiteUrl",
          "gsc_site_url",
          "searchConsoleSiteUrl",
        ]) ?? website?.wordpress_url,
    };
  });
}

async function loadSocialPosts(
  supabase: SupabaseServerClient,
  date: Date,
  articles: AnalyticsArticle[],
): Promise<SocialPostRow[]> {
  const articleIds = articles.map((article) => article.id);
  if (articleIds.length === 0) {
    return [];
  }

  const start = date.toISOString();
  const end = nextUtcDate(date).toISOString();
  const response = await supabase
    .from("social_posts")
    .select("id, article_id, platform_post_id")
    .eq("status", "published")
    .not("article_id", "is", null)
    .gte("published_at", start)
    .lt("published_at", end)
    .in("article_id", articleIds);

  if (response.error) {
    throw new Error(response.error.message || "Failed to load social posts");
  }

  return Array.isArray(response.data) ? (response.data as SocialPostRow[]) : [];
}

async function upsertPerformanceRows(
  supabase: SupabaseServerClient,
  rows: ArticlePerformanceInsert[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }

  const response = await supabase.from("article_performance").upsert(rows, {
    onConflict: "article_id,date,source",
  });

  if (response.error) {
    throw new Error(
      response.error.message || "Failed to upsert article performance",
    );
  }

  return rows.length;
}

function ga4RowsToPerformanceRows(
  rows: GA4ArticleMetricRow[],
  articles: AnalyticsArticle[],
  date: string,
): ArticlePerformanceInsert[] {
  const knownArticleIds = new Set(articles.map((article) => article.id));

  return rows.flatMap((row) => {
    if (!knownArticleIds.has(row.articleId)) return [];

    return [
      {
        article_id: row.articleId,
        date,
        source: "ga4",
        pageviews: Math.max(0, Math.round(toNumber(row.pageviews))),
        unique_visitors: Math.max(0, Math.round(toNumber(row.sessions))),
        avg_session_seconds: row.avgSessionSeconds,
        conversions: Math.max(0, Math.round(toNumber(row.conversions))),
        ctr: null,
        position: null,
        raw_metadata: row.rawMetadata ?? null,
      },
    ];
  });
}

function gscRowsToPerformanceRows(
  rows: GSCArticleQueryRow[],
  articles: AnalyticsArticle[],
  date: string,
): ArticlePerformanceInsert[] {
  const knownArticleIds = new Set(articles.map((article) => article.id));
  const byArticle = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      positionWeight: number;
      unweightedPosition: number;
      queryCount: number;
      queries: GSCArticleQueryRow[];
    }
  >();

  for (const row of rows) {
    if (!knownArticleIds.has(row.articleId)) continue;

    const current = byArticle.get(row.articleId) ?? {
      clicks: 0,
      impressions: 0,
      positionWeight: 0,
      unweightedPosition: 0,
      queryCount: 0,
      queries: [],
    };

    current.clicks += toNumber(row.clicks);
    current.impressions += toNumber(row.impressions);
    current.positionWeight +=
      toNumber(row.position) * toNumber(row.impressions);
    current.unweightedPosition += toNumber(row.position);
    current.queryCount += 1;
    current.queries.push(row);
    byArticle.set(row.articleId, current);
  }

  return [...byArticle.entries()].map(([articleId, aggregate]) => ({
    article_id: articleId,
    date,
    source: "gsc",
    pageviews: Math.max(0, Math.round(aggregate.clicks)),
    unique_visitors: Math.max(0, Math.round(aggregate.impressions)),
    avg_session_seconds: null,
    conversions: 0,
    ctr:
      aggregate.impressions > 0
        ? aggregate.clicks / aggregate.impressions
        : null,
    position:
      aggregate.impressions > 0
        ? aggregate.positionWeight / aggregate.impressions
        : aggregate.queryCount > 0
          ? aggregate.unweightedPosition / aggregate.queryCount
          : null,
    raw_metadata: {
      queries: aggregate.queries,
    },
  }));
}

export function createAnalyticsIngestor(deps: {
  ga4Client: GA4Client;
  gscClient: GSCClient;
  socialPublisher: SocialPublisher;
  supabase: SupabaseServerClient;
}): AnalyticsIngestor {
  async function ingestGa4(
    date: Date,
    articles: AnalyticsArticle[],
  ): Promise<SourceReport> {
    try {
      const rows = await deps.ga4Client.fetchArticleMetrics({ date, articles });
      const inserted = await upsertPerformanceRows(
        deps.supabase,
        ga4RowsToPerformanceRows(rows, articles, dateOnly(date)),
      );
      return { rows: inserted, errors: [] };
    } catch (error) {
      return { rows: 0, errors: [errorMessage(error)] };
    }
  }

  async function ingestGsc(
    date: Date,
    articles: AnalyticsArticle[],
  ): Promise<SourceReport> {
    try {
      const rows = await deps.gscClient.fetchArticleQueries({ date, articles });
      const inserted = await upsertPerformanceRows(
        deps.supabase,
        gscRowsToPerformanceRows(rows, articles, dateOnly(date)),
      );
      return { rows: inserted, errors: [] };
    } catch (error) {
      return { rows: 0, errors: [errorMessage(error)] };
    }
  }

  async function ingestSocial(
    date: Date,
    articles: AnalyticsArticle[],
  ): Promise<SourceReport> {
    const rows: ArticlePerformanceInsert[] = [];
    const errors: string[] = [];

    try {
      const socialPosts = await loadSocialPosts(deps.supabase, date, articles);
      const aggregates = new Map<
        string,
        {
          impressions: number;
          reach: number;
          clicks: number;
          posts: Array<{ postId: string; engagement: SocialEngagement }>;
        }
      >();

      for (const post of socialPosts) {
        if (!post.article_id) continue;

        const postId = post.platform_post_id ?? post.id;
        try {
          const engagement = await deps.socialPublisher.fetchEngagement(postId);
          const current = aggregates.get(post.article_id) ?? {
            impressions: 0,
            reach: 0,
            clicks: 0,
            posts: [],
          };
          current.impressions += socialNumber(engagement, [
            "impressions",
            "views",
          ]);
          current.reach += socialNumber(engagement, ["reach"]);
          current.clicks += socialNumber(engagement, ["clicks"]);
          current.posts.push({ postId, engagement });
          aggregates.set(post.article_id, current);
        } catch (error) {
          errors.push(`${postId}: ${errorMessage(error)}`);
        }
      }

      for (const [articleId, aggregate] of aggregates) {
        rows.push({
          article_id: articleId,
          date: dateOnly(date),
          source: "social",
          pageviews: Math.max(0, Math.round(aggregate.impressions)),
          unique_visitors: Math.max(0, Math.round(aggregate.reach)),
          avg_session_seconds: null,
          conversions: Math.max(0, Math.round(aggregate.clicks)),
          ctr: null,
          position: null,
          raw_metadata: {
            posts: aggregate.posts,
            totals: {
              impressions: aggregate.impressions,
              reach: aggregate.reach,
              clicks: aggregate.clicks,
            },
          },
        });
      }

      const inserted = await upsertPerformanceRows(deps.supabase, rows);
      return { rows: inserted, errors };
    } catch (error) {
      return { rows: 0, errors: [errorMessage(error), ...errors] };
    }
  }

  return {
    async ingest(date, options) {
      let articles: AnalyticsArticle[];
      try {
        articles = await loadArticles(deps.supabase, options);
      } catch (error) {
        const errors = [errorMessage(error)];
        return {
          ga4: { rows: 0, errors },
          gsc: { rows: 0, errors },
          social: { rows: 0, errors },
        };
      }

      const [ga4, gsc, social] = await Promise.all([
        ingestGa4(date, articles),
        ingestGsc(date, articles),
        ingestSocial(date, articles),
      ]);

      return { ga4, gsc, social };
    },
  };
}
