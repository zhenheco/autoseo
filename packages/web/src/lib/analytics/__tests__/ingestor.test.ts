import { describe, expect, it, vi } from "vitest";
import {
  createAnalyticsIngestor,
  type GA4Client,
  type GSCClient,
  type SocialPublisher,
  type SupabaseServerClient,
} from "../ingestor";

type ArticleRow = {
  id: string;
  brand_id: string | null;
  slug: string;
  wordpress_post_url: string | null;
  published_at: string | null;
};

type PerformanceRow = {
  article_id: string;
  date: string;
  source: "ga4" | "gsc" | "social";
  pageviews: number;
  unique_visitors: number;
  conversions: number;
  avg_session_seconds: number | null;
  ctr: number | null;
  position: number | null;
  raw_metadata: unknown;
};

type SocialPostRow = {
  id: string;
  article_id: string | null;
  platform_post_id: string | null;
  status: string;
  published_at: string | null;
};

function createStore(input: {
  articles?: ArticleRow[];
  socialPosts?: SocialPostRow[];
}) {
  const performanceRows: PerformanceRow[] = [];

  class Builder {
    private filters: Array<(row: Record<string, unknown>) => boolean> = [];

    constructor(private readonly table: string) {}

    select() {
      return this;
    }

    eq(column: string, value: unknown) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    not(column: string, operator: string, value: unknown) {
      if (operator === "is" && value === null) {
        this.filters.push((row) => row[column] !== null);
      }
      return this;
    }

    in(column: string, values: unknown[]) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }

    gte(column: string, value: string) {
      this.filters.push((row) => String(row[column]) >= value);
      return this;
    }

    lt(column: string, value: string) {
      this.filters.push((row) => String(row[column]) < value);
      return this;
    }

    async upsert(values: PerformanceRow[]) {
      for (const value of values) {
        const existingIndex = performanceRows.findIndex(
          (row) =>
            row.article_id === value.article_id &&
            row.date === value.date &&
            row.source === value.source,
        );

        if (existingIndex >= 0) {
          performanceRows[existingIndex] = value;
        } else {
          performanceRows.push(value);
        }
      }

      return { data: values, error: null };
    }

    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown[]; error: null }) => TResult1)
        | null,
      onrejected?: ((reason: unknown) => TResult2) | null,
    ) {
      return this.execute().then(onfulfilled, onrejected);
    }

    private async execute() {
      const rows =
        this.table === "generated_articles"
          ? (input.articles ?? [])
          : this.table === "social_posts"
            ? (input.socialPosts ?? [])
            : [];

      return {
        data: rows.filter((row) =>
          this.filters.every((filter) =>
            filter(row as Record<string, unknown>),
          ),
        ),
        error: null,
      };
    }
  }

  const supabase = {
    from(table: string) {
      return new Builder(table);
    },
  } as unknown as SupabaseServerClient;

  return { performanceRows, supabase };
}

const date = new Date("2026-05-21T00:00:00.000Z");

const articles: ArticleRow[] = [
  {
    id: "article-1",
    brand_id: "brand-a",
    slug: "first",
    wordpress_post_url: "https://example.com/first",
    published_at: "2026-05-20T00:00:00.000Z",
  },
  {
    id: "article-2",
    brand_id: "brand-a",
    slug: "second",
    wordpress_post_url: "https://example.com/second",
    published_at: "2026-05-20T00:00:00.000Z",
  },
  {
    id: "article-3",
    brand_id: "brand-b",
    slug: "third",
    wordpress_post_url: "https://example.com/third",
    published_at: "2026-05-20T00:00:00.000Z",
  },
];

function createDeps(store = createStore({ articles })) {
  const ga4Client: GA4Client = {
    fetchArticleMetrics: vi.fn(async () => [
      {
        articleId: "article-1",
        pageviews: 10,
        sessions: 4,
        conversions: 1,
        avgSessionSeconds: 30,
      },
      {
        articleId: "article-2",
        pageviews: 20,
        sessions: 8,
        conversions: 2,
        avgSessionSeconds: 45,
      },
      {
        articleId: "article-3",
        pageviews: 30,
        sessions: 12,
        conversions: 3,
        avgSessionSeconds: 60,
      },
    ]),
  };
  const gscClient: GSCClient = {
    fetchArticleQueries: vi.fn(async () => []),
  };
  const socialPublisher: SocialPublisher = {
    fetchEngagement: vi.fn(async () => ({
      impressions: 0,
      clicks: 0,
      likes: 0,
      comments: 0,
      shares: 0,
    })),
  };

  return {
    deps: {
      ga4Client,
      gscClient,
      socialPublisher,
      supabase: store.supabase,
    },
    store,
    ga4Client,
    gscClient,
    socialPublisher,
  };
}

describe("createAnalyticsIngestor", () => {
  it("inserts one article_performance row per GA4 row", async () => {
    const { deps, store } = createDeps();
    const report = await createAnalyticsIngestor(deps).ingest(date);

    expect(report.ga4).toMatchObject({ rows: 3, errors: [] });
    expect(store.performanceRows).toHaveLength(3);
    expect(store.performanceRows.map((row) => row.article_id)).toEqual([
      "article-1",
      "article-2",
      "article-3",
    ]);
  });

  it("updates existing same-day rows instead of duplicating them", async () => {
    const { deps, store, ga4Client } = createDeps();
    const ingestor = createAnalyticsIngestor(deps);

    await ingestor.ingest(date);
    vi.mocked(ga4Client.fetchArticleMetrics).mockResolvedValueOnce([
      {
        articleId: "article-1",
        pageviews: 99,
        sessions: 9,
        conversions: 0,
        avgSessionSeconds: 12,
      },
    ]);

    const report = await ingestor.ingest(date);

    expect(report.ga4).toMatchObject({ rows: 1, errors: [] });
    expect(store.performanceRows).toHaveLength(3);
    expect(
      store.performanceRows.find((row) => row.article_id === "article-1"),
    ).toMatchObject({ pageviews: 99, unique_visitors: 9 });
  });

  it("records GSC errors while GA4 and social ingestion still run", async () => {
    const store = createStore({
      articles,
      socialPosts: [
        {
          id: "social-1",
          article_id: "article-1",
          platform_post_id: "post-1",
          status: "published",
          published_at: "2026-05-21T10:00:00.000Z",
        },
      ],
    });
    const { deps, gscClient, socialPublisher } = createDeps(store);
    vi.mocked(gscClient.fetchArticleQueries).mockRejectedValueOnce(
      new Error("GSC unavailable"),
    );
    vi.mocked(socialPublisher.fetchEngagement).mockResolvedValueOnce({
      impressions: 100,
      clicks: 5,
      likes: 8,
      comments: 2,
      shares: 1,
    });

    const report = await createAnalyticsIngestor(deps).ingest(date);

    expect(report.ga4.rows).toBe(3);
    expect(report.gsc).toEqual({
      rows: 0,
      errors: ["GSC unavailable"],
    });
    expect(report.social).toMatchObject({ rows: 1, errors: [] });
    expect(socialPublisher.fetchEngagement).toHaveBeenCalledWith("post-1");
  });

  it("passes onlyBrandId filtered articles to every source", async () => {
    const { deps, ga4Client, gscClient } = createDeps();

    await createAnalyticsIngestor(deps).ingest(date, {
      onlyBrandId: "brand-a",
    });

    expect(
      vi.mocked(ga4Client.fetchArticleMetrics).mock.calls[0]?.[0].articles,
    ).toHaveLength(2);
    expect(
      vi.mocked(gscClient.fetchArticleQueries).mock.calls[0]?.[0].articles,
    ).toHaveLength(2);
  });
});
