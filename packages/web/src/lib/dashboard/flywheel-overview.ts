export type QueryClient = {
  from(table: string): {
    select(
      columns?: string,
      options?: { count?: string; head?: boolean },
    ): QueryFilterLike;
  };
};

type QueryResult = {
  data: unknown;
  count?: number | null;
  error?: unknown;
};

type QueryFilterLike = PromiseLike<QueryResult> & {
  eq(column: string, value: unknown): QueryFilterLike;
  gte(column: string, value: unknown): QueryFilterLike;
  lte(column: string, value: unknown): QueryFilterLike;
  is(column: string, value: unknown): QueryFilterLike;
  not(column: string, operator: string, value: unknown): QueryFilterLike;
  order(column: string, options?: { ascending?: boolean }): QueryFilterLike;
  limit(count: number): QueryFilterLike;
};

type JsonRecord = Record<string, unknown>;

export type FlywheelTrendSignal = {
  id: string;
  brandId: string;
  topic: string;
  source: string;
  confidence: number;
};

export type PublishedFeedItem =
  | {
      type: "article";
      id: string;
      title: string;
      slug: string;
      publishedAt: string;
    }
  | {
      type: "social";
      id: string;
      articleId: string | null;
      title: string;
      platform: string;
      publishedAt: string;
      engagement: number;
    };

export type PerformanceSnapshot = {
  totalPageviews: number;
  totalSocialEngagement: number;
  topArticle: {
    id: string;
    title: string;
    views: number;
  } | null;
  topPlatform: {
    platform: string;
    engagement: number;
  } | null;
};

export type AutomationPipelineCounts = {
  scheduled: number;
  published: number;
};

export type FlywheelOverview = {
  articleCount: number;
  trendSignals: FlywheelTrendSignal[];
  recentlyPublished: PublishedFeedItem[];
  performance: PerformanceSnapshot;
  automation: AutomationPipelineCounts;
};

export async function loadFlywheelOverview(
  supabase: QueryClient,
  brandId: string,
): Promise<FlywheelOverview> {
  const now = new Date();
  const lastSevenDaysStart = startOfDay(addDays(now, -6));
  const lastSevenDaysEnd = endOfDay(now);

  const [
    articleCountResult,
    trendsResult,
    articleFeedResult,
    socialFeedResult,
    performanceResult,
    socialEngagementResult,
    automation,
  ] = await Promise.all([
    supabase
      .from("generated_articles")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
    supabase
      .from("trend_signals")
      .select("id, brand_id, topic, source, confidence, metadata, expires_at")
      .eq("brand_id", brandId)
      .is("used_at", null)
      .order("confidence", { ascending: false })
      .limit(5),
    supabase
      .from("generated_articles")
      .select("id, title, slug, published_at")
      .eq("brand_id", brandId)
      .not("published_at", "is", null)
      .gte("published_at", lastSevenDaysStart.toISOString())
      .lte("published_at", lastSevenDaysEnd.toISOString())
      .order("published_at", { ascending: false })
      .limit(7),
    supabase
      .from("social_posts")
      .select(
        [
          "id",
          "article_id",
          "published_at",
          "status",
          "content_text",
          "metrics",
          "social_accounts(platform, platform_username)",
          "generated_articles!inner(id, title, slug, brand_id)",
        ].join(","),
      )
      .eq("status", "published")
      .eq("generated_articles.brand_id", brandId)
      .not("published_at", "is", null)
      .gte("published_at", lastSevenDaysStart.toISOString())
      .lte("published_at", lastSevenDaysEnd.toISOString())
      .order("published_at", { ascending: false })
      .limit(7),
    supabase
      .from("article_performance")
      .select(
        [
          "article_id",
          "date",
          "source",
          "pageviews",
          "conversions",
          "raw_metadata",
          "generated_articles!inner(id, title, slug, brand_id)",
        ].join(","),
      )
      .gte("date", dateOnly(lastSevenDaysStart))
      .lte("date", dateOnly(lastSevenDaysEnd))
      .eq("generated_articles.brand_id", brandId),
    supabase
      .from("social_posts")
      .select(
        [
          "id",
          "published_at",
          "status",
          "metrics",
          "social_accounts(platform)",
          "generated_articles!inner(id, brand_id)",
        ].join(","),
      )
      .eq("status", "published")
      .eq("generated_articles.brand_id", brandId)
      .not("published_at", "is", null)
      .gte("published_at", lastSevenDaysStart.toISOString())
      .lte("published_at", lastSevenDaysEnd.toISOString()),
    loadAutomationPipelineCounts(supabase, brandId, now),
  ]);

  const articleRows = rows(articleFeedResult.data);
  const socialRows = rows(socialFeedResult.data);

  return {
    articleCount: articleCountResult.count ?? 0,
    trendSignals: rows(trendsResult.data)
      .map(toTrendSignal)
      .sort((left, right) => right.confidence - left.confidence)
      .slice(0, 5),
    recentlyPublished: buildFeed(articleRows, socialRows),
    performance: buildPerformanceSnapshot(
      rows(performanceResult.data),
      rows(socialEngagementResult.data),
    ),
    automation,
  };
}

export async function loadAutomationPipelineCounts(
  supabase: QueryClient,
  brandId: string,
  now = new Date(),
): Promise<AutomationPipelineCounts> {
  const weekStart = startOfWeek(now);
  const weekEnd = endOfDay(addDays(weekStart, 6));

  const [scheduledResult, publishedResult] = await Promise.all([
    supabase
      .from("generated_articles")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .not("scheduled_publish_at", "is", null)
      .gte("scheduled_publish_at", weekStart.toISOString())
      .lte("scheduled_publish_at", weekEnd.toISOString()),
    supabase
      .from("generated_articles")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId)
      .not("published_at", "is", null)
      .gte("published_at", weekStart.toISOString())
      .lte("published_at", weekEnd.toISOString()),
  ]);

  return {
    scheduled: scheduledResult.count ?? 0,
    published: publishedResult.count ?? 0,
  };
}

function buildFeed(articleRows: JsonRecord[], socialRows: JsonRecord[]) {
  const articleItems: PublishedFeedItem[] = articleRows
    .filter((row) => typeof row.published_at === "string")
    .map((row) => ({
      type: "article",
      id: String(row.id),
      title: String(row.title ?? "Untitled article"),
      slug: String(row.slug ?? row.id),
      publishedAt: String(row.published_at),
    }));

  const socialItems: PublishedFeedItem[] = socialRows
    .filter((row) => typeof row.published_at === "string")
    .map((row) => {
      const article = asRecord(row.generated_articles);
      const account = asRecord(row.social_accounts);
      return {
        type: "social",
        id: String(row.id),
        articleId: row.article_id ? String(row.article_id) : null,
        title: String(row.content_text ?? article?.title ?? "Social post"),
        platform: String(account?.platform ?? "social"),
        publishedAt: String(row.published_at),
        engagement: engagementFromMetrics(asRecord(row.metrics)),
      };
    });

  return [...articleItems, ...socialItems]
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, 7);
}

function buildPerformanceSnapshot(
  performanceRows: JsonRecord[],
  socialRows: JsonRecord[],
): PerformanceSnapshot {
  const articles = new Map<
    string,
    { id: string; title: string; views: number }
  >();
  let totalPageviews = 0;

  for (const row of performanceRows) {
    const pageviews = toNumber(row.pageviews);
    totalPageviews += pageviews;

    const article = asRecord(row.generated_articles);
    const articleId = String(row.article_id ?? article?.id ?? "");
    if (!articleId) continue;

    const current = articles.get(articleId) ?? {
      id: articleId,
      title: String(article?.title ?? "Untitled article"),
      views: 0,
    };
    current.views += pageviews;
    articles.set(articleId, current);
  }

  const platformEngagement = new Map<string, number>();
  for (const row of socialRows) {
    const account = asRecord(row.social_accounts);
    const platform = String(account?.platform ?? "social");
    platformEngagement.set(
      platform,
      (platformEngagement.get(platform) ?? 0) +
        engagementFromMetrics(asRecord(row.metrics)),
    );
  }

  const topArticle =
    Array.from(articles.values()).sort(
      (left, right) => right.views - left.views,
    )[0] ?? null;
  const topPlatformEntry = Array.from(platformEngagement.entries()).sort(
    (left, right) => right[1] - left[1],
  )[0];

  return {
    totalPageviews,
    totalSocialEngagement: Array.from(platformEngagement.values()).reduce(
      (sum, value) => sum + value,
      0,
    ),
    topArticle,
    topPlatform: topPlatformEntry
      ? { platform: topPlatformEntry[0], engagement: topPlatformEntry[1] }
      : null,
  };
}

function toTrendSignal(row: JsonRecord): FlywheelTrendSignal {
  return {
    id: String(row.id),
    brandId: String(row.brand_id),
    topic: String(row.topic ?? "Untitled topic"),
    source: String(row.source ?? "manual"),
    confidence: Math.max(0, Math.min(1, Number(row.confidence) || 0)),
  };
}

function rows(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? (value as JsonRecord[]) : [];
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function toNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function engagementFromMetrics(metrics: JsonRecord | null): number {
  if (!metrics) return 0;
  return (
    toNumber(metrics.likes) +
    toNumber(metrics.comments) +
    toNumber(metrics.shares) +
    toNumber(metrics.clicks) +
    toNumber(metrics.reactions)
  );
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const mondayOffset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - mondayOffset);
  return copy;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
