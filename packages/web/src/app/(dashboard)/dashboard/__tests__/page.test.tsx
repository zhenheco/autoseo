import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserCompanies: vi.fn(),
}));

const permissionMocks = vi.hoisted(() => ({
  checkPagePermission: vi.fn(),
  getUserSubscriptionTier: vi.fn(),
}));

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

const brandApiMocks = vi.hoisted(() => ({
  fetchBrandsFromApi: vi.fn(),
}));

vi.mock("@shared/auth", () => authMocks);
vi.mock("@shared/auth/permissions", () => permissionMocks);
vi.mock("@shared/supabase", () => supabaseMocks);
vi.mock("@/lib/brands/server-api", () => brandApiMocks);
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));
vi.mock("next/navigation", () => navigationMocks);
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock("../dashboard-client", () => ({
  DashboardClient: () => <div>legacy dashboard client</div>,
}));

type Row = Record<string, unknown>;

type FixtureData = {
  trend_signals?: Row[];
  generated_articles?: Row[];
  social_posts?: Row[];
  article_performance?: Row[];
};

type QueryState = {
  selectColumns?: string;
  count?: string;
  head?: boolean;
  filters: Array<{ op: string; column: string; value: unknown }>;
  orderColumn?: string;
  ascending?: boolean;
  limitCount?: number;
};

class QueryBuilder {
  private state: QueryState = { filters: [] };

  constructor(
    private readonly table: string,
    private readonly data: FixtureData,
  ) {}

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    this.state.selectColumns = columns;
    this.state.count = options?.count;
    this.state.head = options?.head;
    return this;
  }

  eq(column: string, value: unknown) {
    this.state.filters.push({ op: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.state.filters.push({ op: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.state.filters.push({ op: "lte", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.state.filters.push({ op: "is", column, value });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    this.state.filters.push({ op: `not.${operator}`, column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.state.orderColumn = column;
    this.state.ascending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.state.limitCount = count;
    return this;
  }

  async single() {
    const result = await this.execute();
    return {
      ...result,
      data: Array.isArray(result.data) ? result.data[0] : result.data,
    };
  }

  async maybeSingle() {
    return this.single();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    const rows = resolveRows(this.table, this.data, this.state);
    if (this.state.head) {
      return { data: null, count: rows.length, error: null };
    }
    return { data: rows, count: null, error: null };
  }
}

function resolveRows(table: string, data: FixtureData, state: QueryState) {
  if (table === "company_members") {
    return [{ company_id: "company-1" }];
  }
  if (table === "company_subscriptions") {
    return [
      {
        monthly_quota_balance: 10,
        purchased_token_balance: 0,
        monthly_token_quota: 10,
      },
    ];
  }
  if (table === "website_configs") {
    return [];
  }

  let rows = [...((data[table as keyof FixtureData] ?? []) as Row[])];

  for (const filter of state.filters) {
    rows = rows.filter((row) => matchesFilter(row, filter));
  }

  if (state.orderColumn) {
    rows.sort((left, right) => {
      const leftValue = String(readColumn(left, state.orderColumn ?? "") ?? "");
      const rightValue = String(
        readColumn(right, state.orderColumn ?? "") ?? "",
      );
      return state.ascending
        ? leftValue.localeCompare(rightValue)
        : rightValue.localeCompare(leftValue);
    });
  }

  return typeof state.limitCount === "number"
    ? rows.slice(0, state.limitCount)
    : rows;
}

function matchesFilter(
  row: Row,
  filter: { op: string; column: string; value: unknown },
) {
  const value = readColumn(row, filter.column);
  if (filter.op === "eq") return value === filter.value;
  if (filter.op === "gte") return String(value ?? "") >= String(filter.value);
  if (filter.op === "lte") return String(value ?? "") <= String(filter.value);
  if (filter.op === "is") return value === filter.value;
  if (filter.op === "not.is") return value !== filter.value;
  return true;
}

function readColumn(row: Row, column: string): unknown {
  if (column.startsWith("generated_articles.")) {
    const key = column.replace("generated_articles.", "");
    const article = row.generated_articles as Row | undefined;
    return article?.[key];
  }
  return row[column];
}

function createSupabaseMock(data: FixtureData) {
  return {
    from(table: string) {
      return new QueryBuilder(table, data);
    },
  };
}

function brand(id: string, name: string, automationLevel = 3) {
  return {
    id,
    company_id: "company-1",
    name,
    voice_tone: null,
    target_audience: null,
    value_props: null,
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: false,
    created_at: "2026-05-20T00:00:00.000Z",
    updated_at: "2026-05-20T00:00:00.000Z",
    deleted_at: null,
    automation_level: automationLevel,
    auto_articles_per_week: 4,
    auto_publish_to_social: true,
  };
}

const fullData: FixtureData = {
  trend_signals: [
    {
      id: "trend-1",
      brand_id: "brand-1",
      topic: "AI SEO workflows",
      source: "perplexity",
      confidence: 0.94,
      metadata: null,
      used_at: null,
      expires_at: "2026-05-29",
    },
    {
      id: "trend-2",
      brand_id: "brand-1",
      topic: "Programmatic content QA",
      source: "gsc",
      confidence: 0.88,
      metadata: null,
      used_at: null,
      expires_at: "2026-05-29",
    },
    {
      id: "trend-b",
      brand_id: "brand-2",
      topic: "Contoso trend",
      source: "manual",
      confidence: 0.99,
      metadata: null,
      used_at: null,
      expires_at: "2026-05-29",
    },
  ],
  generated_articles: [
    {
      id: "article-1",
      brand_id: "brand-1",
      company_id: "company-1",
      title: "AI SEO weekly playbook",
      slug: "ai-seo-weekly-playbook",
      status: "published",
      published_at: "2026-05-21T09:00:00.000Z",
      scheduled_publish_at: null,
    },
    {
      id: "article-2",
      brand_id: "brand-1",
      company_id: "company-1",
      title: "Scheduled automation brief",
      slug: "scheduled-automation-brief",
      status: "generated",
      published_at: null,
      scheduled_publish_at: "2026-05-23T09:00:00.000Z",
    },
    {
      id: "article-b",
      brand_id: "brand-2",
      company_id: "company-1",
      title: "Contoso dashboard result",
      slug: "contoso-dashboard-result",
      status: "published",
      published_at: "2026-05-21T10:00:00.000Z",
      scheduled_publish_at: null,
    },
  ],
  social_posts: [
    {
      id: "post-1",
      article_id: "article-1",
      status: "published",
      content_text: "AI SEO weekly playbook",
      published_at: "2026-05-21T11:00:00.000Z",
      scheduled_at: "2026-05-21T11:00:00.000Z",
      metrics: { likes: 20, comments: 4, shares: 3, clicks: 8 },
      social_accounts: { platform: "linkedin", platform_username: "northwind" },
      generated_articles: {
        id: "article-1",
        brand_id: "brand-1",
        title: "AI SEO weekly playbook",
        slug: "ai-seo-weekly-playbook",
      },
    },
  ],
  article_performance: [
    {
      article_id: "article-1",
      date: "2026-05-21",
      source: "ga4",
      pageviews: 1200,
      unique_visitors: 850,
      conversions: 3,
      raw_metadata: null,
      generated_articles: {
        id: "article-1",
        brand_id: "brand-1",
        company_id: "company-1",
        title: "AI SEO weekly playbook",
        slug: "ai-seo-weekly-playbook",
      },
    },
    {
      article_id: "article-1",
      date: "2026-05-21",
      source: "social",
      pageviews: 300,
      unique_visitors: 250,
      conversions: 12,
      raw_metadata: null,
      generated_articles: {
        id: "article-1",
        brand_id: "brand-1",
        company_id: "company-1",
        title: "AI SEO weekly playbook",
        slug: "ai-seo-weekly-playbook",
      },
    },
    {
      article_id: "article-b",
      date: "2026-05-21",
      source: "ga4",
      pageviews: 25,
      unique_visitors: 20,
      conversions: 0,
      raw_metadata: null,
      generated_articles: {
        id: "article-b",
        brand_id: "brand-2",
        company_id: "company-1",
        title: "Contoso dashboard result",
        slug: "contoso-dashboard-result",
      },
    },
  ],
};

describe("flywheel dashboard page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    authMocks.getUser.mockResolvedValue({
      id: "user-1",
      email: "ops@acme.test",
    });
    authMocks.getUserCompanies.mockResolvedValue([{ id: "company-1" }]);
    permissionMocks.getUserSubscriptionTier.mockResolvedValue("pro");
    brandApiMocks.fetchBrandsFromApi.mockResolvedValue([
      brand("brand-1", "Northwind"),
      brand("brand-2", "Contoso", 1),
    ]);
    supabaseMocks.createClient.mockResolvedValue(createSupabaseMock(fullData));
  });

  it("renders all flywheel widgets with mocked data", async () => {
    const { default: DashboardPage } = await import("../page");

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "This week's recommended topics" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recently published" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Performance snapshot" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Automation status" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Quick actions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI SEO workflows")).toBeInTheDocument();
    expect(
      screen.getAllByText("AI SEO weekly playbook").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("1,500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Top article/ })).toHaveAttribute(
      "href",
      "/dashboard/articles/article-1",
    );
  });

  it("uses the brand selected by dashboard brand context", async () => {
    const { default: DashboardPage } = await import("../page");

    render(
      await DashboardPage({
        searchParams: Promise.resolve({ brand: "brand-2" }),
      }),
    );

    expect(screen.getByText("Active brand: Contoso")).toBeInTheDocument();
    expect(screen.getByText("Contoso trend")).toBeInTheDocument();
    expect(screen.getByText("Contoso dashboard result")).toBeInTheDocument();
    expect(screen.queryByText("AI SEO workflows")).not.toBeInTheDocument();
  });

  it("shows the onboarding EmptyState when the active brand has no articles", async () => {
    const { default: DashboardPage } = await import("../page");
    brandApiMocks.fetchBrandsFromApi.mockResolvedValue([
      brand("new-brand", "New Brand", 1),
    ]);
    supabaseMocks.createClient.mockResolvedValue(
      createSupabaseMock({
        trend_signals: [],
        generated_articles: [],
        social_posts: [],
        article_performance: [],
      }),
    );

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { name: "Start this brand's flywheel" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Connect a social account")).toBeInTheDocument();
    expect(screen.getByText("Set brand voice")).toBeInTheDocument();
    expect(screen.getByText("Generate first article")).toBeInTheDocument();
    expect(screen.getByText("Configure trend keywords")).toBeInTheDocument();
  });

  it("renders quick action links for the active brand", async () => {
    const { default: DashboardPage } = await import("../page");

    render(await DashboardPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("link", { name: "Generate new article" }),
    ).toHaveAttribute("href", "/dashboard/articles/new?brand=brand-1");
    expect(
      screen.getByRole("link", { name: "Connect social" }),
    ).toHaveAttribute("href", "/dashboard/social?brand=brand-1");
    expect(
      screen.getByRole("link", { name: "Edit brand memory" }),
    ).toHaveAttribute("href", "/dashboard/brands/brand-1/memory");
  });
});
