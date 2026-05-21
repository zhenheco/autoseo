import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName = "brands" | "company_subscriptions" | "article_performance";

type BrandRow = {
  id: string;
  company_id: string;
  name: string;
  deleted_at: string | null;
};

type SubscriptionRow = {
  company_id: string;
  status: string;
  subscription_plans: { slug: "solo" | "pro" } | null;
};

type PerformanceRow = {
  article_id: string;
  date: string;
  source: "ga4" | "gsc" | "social";
  pageviews: number;
  unique_visitors: number;
  avg_session_seconds: number | null;
  ctr: number | null;
  position: number | null;
  generated_articles: {
    id: string;
    title: string;
    slug: string;
    brand_id: string | null;
    company_id: string | null;
  };
};

type Filter = {
  column: string;
  operator: "eq" | "is" | "gte" | "lte";
  value: unknown;
};

const ids = {
  company: "company-1",
  otherCompany: "company-2",
  brand: "brand-1",
  article1: "article-1",
  article2: "article-2",
};

const state = vi.hoisted(() => ({
  companyId: "company-1",
  supabase: null as FakeSupabaseClient | null,
}));

const routeAuth = vi.hoisted(() => ({
  withRouteAuth: vi.fn(
    (
      _mode: string,
      handler: (
        request: Request,
        context: {
          authMode: "company";
          companyId: string;
          user: { id: string };
          supabase: FakeSupabaseClient;
        },
      ) => Promise<Response> | Response,
    ) =>
      (request: Request) =>
        handler(request, {
          authMode: "company",
          companyId: state.companyId,
          user: { id: "user-1" },
          supabase: state.supabase!,
        }),
  ),
}));

vi.mock("@/lib/api/route-auth", () => routeAuth);

class FakeQueryBuilder {
  private filters: Filter[] = [];
  private orderColumn: string | null = null;

  constructor(
    private readonly db: FakeSupabaseClient,
    private readonly table: TableName,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, operator: "eq", value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, operator: "is", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, operator: "gte", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, operator: "lte", value });
    return this;
  }

  order(column: string) {
    this.orderColumn = column;
    return this;
  }

  maybeSingle() {
    const result = this.execute();
    const rows = Array.isArray(result.data) ? result.data : [];
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(): QueryResult {
    const rows =
      this.table === "brands"
        ? this.db.brands
        : this.table === "company_subscriptions"
          ? this.db.subscriptions
          : this.db.performance;

    const filtered = rows.filter((row) => this.matches(row));

    if (this.table === "article_performance" && this.orderColumn === "date") {
      filtered.sort((a, b) =>
        String((a as PerformanceRow).date).localeCompare(
          String((b as PerformanceRow).date),
        ),
      );
    }

    return { data: filtered, error: null };
  }

  private matches(row: unknown) {
    return this.filters.every((filter) => {
      const value = readPath(row, filter.column);
      if (filter.operator === "is") return value === filter.value;
      if (filter.operator === "gte")
        return String(value) >= String(filter.value);
      if (filter.operator === "lte")
        return String(value) <= String(filter.value);
      return value === filter.value;
    });
  }
}

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

class FakeSupabaseClient {
  readonly calls: Array<{ table: TableName; column: string; value: unknown }> =
    [];

  constructor(
    readonly brands: BrandRow[],
    readonly subscriptions: SubscriptionRow[],
    readonly performance: PerformanceRow[],
  ) {}

  from(table: TableName) {
    return new FakeQueryBuilder(this, table);
  }
}

function readPath(row: unknown, path: string) {
  if (path === "generated_articles.brand_id") {
    return (row as PerformanceRow).generated_articles.brand_id;
  }
  if (path === "generated_articles.company_id") {
    return (row as PerformanceRow).generated_articles.company_id;
  }
  return (row as Record<string, unknown>)[path];
}

function performance(
  overrides: Omit<Partial<PerformanceRow>, "generated_articles"> & {
    generated_articles?: Partial<PerformanceRow["generated_articles"]>;
  } = {},
): PerformanceRow {
  return {
    article_id: ids.article1,
    date: "2026-05-20",
    source: "ga4",
    pageviews: 100,
    unique_visitors: 45,
    avg_session_seconds: 90,
    ctr: 0.12,
    position: 4.5,
    ...overrides,
    generated_articles: {
      id: overrides.article_id ?? ids.article1,
      title: "SEO Growth Guide",
      slug: "seo-growth-guide",
      brand_id: ids.brand,
      company_id: ids.company,
      ...overrides.generated_articles,
    },
  };
}

function request(query: string) {
  return new Request(`https://example.com/api/analytics?${query}`);
}

describe("GET /api/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.companyId = ids.company;
    state.supabase = new FakeSupabaseClient(
      [
        {
          id: ids.brand,
          company_id: ids.company,
          name: "Acme",
          deleted_at: null,
        },
      ],
      [
        {
          company_id: ids.company,
          status: "active",
          subscription_plans: { slug: "pro" },
        },
      ],
      [
        performance({ date: "2026-05-20", pageviews: 100 }),
        performance({
          article_id: ids.article2,
          source: "gsc",
          pageviews: 50,
          unique_visitors: 30,
          generated_articles: {
            id: ids.article2,
            title: "Search Console Tips",
            slug: "search-console-tips",
          },
        }),
      ],
    );
  });

  it("declares the analytics route company scoped", async () => {
    await import("../route");

    expect(routeAuth.withRouteAuth).toHaveBeenCalledWith(
      "company",
      expect.any(Function),
    );
  });

  it("aggregates brand-scoped article performance", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      request(
        "brandId=brand-1&from=2026-05-01&to=2026-05-21&source=all",
      ) as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kpis: {
        totalPageviews: 150,
        uniqueVisitors: 75,
        topArticle: { title: "SEO Growth Guide", views: 100 },
        topPlatform: { source: "ga4", views: 100 },
      },
      articles: [
        expect.objectContaining({
          title: "SEO Growth Guide",
          source: "ga4",
          pageviews: 100,
        }),
        expect.objectContaining({
          title: "Search Console Tips",
          source: "gsc",
          pageviews: 50,
        }),
      ],
    });
  });

  it("rejects 90-day queries for Solo plans", async () => {
    state.supabase = new FakeSupabaseClient(
      [
        {
          id: ids.brand,
          company_id: ids.company,
          name: "Acme",
          deleted_at: null,
        },
      ],
      [
        {
          company_id: ids.company,
          status: "active",
          subscription_plans: { slug: "solo" },
        },
      ],
      [performance()],
    );
    const { GET } = await import("../route");

    const response = await GET(
      request(
        "brandId=brand-1&from=2026-02-20&to=2026-05-21&source=all",
      ) as never,
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "QUOTA_EXCEEDED",
    });
  });
});
