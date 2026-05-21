import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAutomationScheduler,
  type ArticleJob,
  type SupabaseServerClient,
} from "./scheduler";
import type { Brand } from "@/lib/brands/active-brand";
import type { QuotaEnforcer } from "@/lib/quota/enforcer";
import type { TrendsAggregator } from "@/lib/trends/aggregator";

type TableRow = Record<string, unknown>;
type Filter =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "gte"; column: string; value: unknown }
  | { kind: "lte"; column: string; value: unknown }
  | { kind: "is"; column: string; value: unknown }
  | { kind: "or"; filters: string };

class FakeSupabase {
  readonly articleJobs: TableRow[];
  readonly brands: TableRow[];
  readonly trendSignals: TableRow[];
  private articleJobSequence = 0;

  constructor(input: {
    articleJobs?: TableRow[];
    brands?: TableRow[];
    trendSignals?: TableRow[];
  }) {
    this.articleJobs = input.articleJobs ?? [];
    this.brands = input.brands ?? [];
    this.trendSignals = input.trendSignals ?? [];
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }

  nextArticleJobId() {
    this.articleJobSequence += 1;
    return `job-${this.articleJobSequence}`;
  }

  rowsFor(table: string) {
    if (table === "article_jobs") return this.articleJobs;
    if (table === "brands") return this.brands;
    if (table === "trend_signals") return this.trendSignals;
    return [];
  }
}

class FakeQuery {
  private filters: Filter[] = [];
  private limitCount: number | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;
  private selectOptions: { count?: "exact"; head?: boolean } | undefined;
  private insertPayload: unknown;
  private updatePayload: TableRow | null = null;

  constructor(
    private readonly db: FakeSupabase,
    private readonly table: string,
  ) {}

  select(_columns = "*", options?: { count?: "exact"; head?: boolean }) {
    this.selectOptions = options;
    return this;
  }

  insert(values: unknown) {
    this.insertPayload = values;
    return this;
  }

  update(values: TableRow) {
    this.updatePayload = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ kind: "eq", column, value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ kind: "gte", column, value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ kind: "lte", column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ kind: "is", column, value });
    return this;
  }

  or(filters: string) {
    this.filters.push({ kind: "or", filters });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending ?? true,
    };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single<T>() {
    return this.execute().then((response) => ({
      data: (Array.isArray(response.data)
        ? response.data[0]
        : response.data) as T | null,
      error: response.error,
    }));
  }

  maybeSingle<T>() {
    return this.single<T>();
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown[] | null;
          count: number | null;
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    if (this.insertPayload !== undefined) {
      const rows = (
        Array.isArray(this.insertPayload)
          ? this.insertPayload
          : [this.insertPayload]
      ) as TableRow[];
      const inserted = rows.map((row) => ({
        id: this.db.nextArticleJobId(),
        created_at: new Date().toISOString(),
        ...row,
      }));
      this.db.rowsFor(this.table).push(...inserted);
      return { data: inserted, count: null, error: null };
    }

    const rows = this.filteredRows();

    if (this.updatePayload) {
      for (const row of rows) {
        Object.assign(row, this.updatePayload);
      }
      return { data: rows, count: null, error: null };
    }

    return {
      data: this.selectOptions?.head ? null : rows,
      count: this.selectOptions?.count === "exact" ? rows.length : null,
      error: null,
    };
  }

  private filteredRows() {
    let rows = [...this.db.rowsFor(this.table)].filter((row) =>
      this.filters.every((filter) => matchesFilter(row, filter)),
    );

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      rows = rows.sort((a, b) => {
        const left = a[column];
        const right = b[column];
        if (left === right) return 0;
        if (left === null || left === undefined) return ascending ? -1 : 1;
        if (right === null || right === undefined) return ascending ? 1 : -1;
        return (left > right ? 1 : -1) * (ascending ? 1 : -1);
      });
    }

    return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
  }
}

function matchesFilter(row: TableRow, filter: Filter) {
  const value = filter.kind === "or" ? undefined : row[filter.column];

  if (filter.kind === "eq") return value === filter.value;
  if (filter.kind === "is") return value === filter.value;
  if (filter.kind === "gte") return String(value) >= String(filter.value);
  if (filter.kind === "lte") return String(value) <= String(filter.value);
  if (filter.kind === "or") {
    const expiresAt = row.expires_at;
    return (
      expiresAt === null ||
      expiresAt === undefined ||
      String(expiresAt) > nowIso()
    );
  }

  return true;
}

function nowIso() {
  return new Date().toISOString();
}

function buildBrand(overrides: Partial<Brand>): Brand {
  return {
    id: "brand-1",
    company_id: "company-1",
    name: "Brand",
    voice_tone: null,
    target_audience: null,
    value_props: null,
    brand_guidelines: null,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    is_default: true,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    deleted_at: null,
    automation_level: 3,
    auto_articles_per_week: 3,
    auto_publish_to_social: false,
    ...overrides,
  };
}

function buildSignal(index: number, confidence = 0.9): TableRow {
  return {
    id: `signal-${index}`,
    brand_id: "brand-1",
    topic: `topic-${index}`,
    source: "perplexity",
    confidence,
    metadata: { sourceUrl: `https://example.com/${index}` },
    used_at: null,
    expires_at: null,
  };
}

function buildScheduler(input: {
  supabase?: FakeSupabase;
  quota?: Partial<QuotaEnforcer>;
  trends?: Partial<TrendsAggregator>;
}) {
  const quotaEnforcer = {
    canConsume: vi.fn(async () => ({
      allowed: true,
      used: 0,
      cap: 30,
      remaining: 30,
      plan: "solo" as const,
      resource: "articles",
    })),
    consume: vi.fn(),
    getUsage: vi.fn(),
    ...input.quota,
  } as unknown as QuotaEnforcer;
  const trendsAggregator = {
    fetchTrends: vi.fn(async () => []),
    ...input.trends,
  } as unknown as TrendsAggregator;

  return createAutomationScheduler({
    supabase: (input.supabase ??
      new FakeSupabase({})) as unknown as SupabaseServerClient,
    quotaEnforcer,
    trendsAggregator,
  });
}

function jobsMetadata(jobs: ArticleJob[]) {
  return jobs.map((job) => job.metadata as Record<string, unknown>);
}

describe("createAutomationScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns no jobs for L1 and L2 brands", async () => {
    const scheduler = buildScheduler({ supabase: new FakeSupabase({}) });

    await expect(
      scheduler.tickWeekly(buildBrand({ automation_level: 1 })),
    ).resolves.toEqual([]);
    await expect(
      scheduler.tickWeekly(buildBrand({ automation_level: 2 })),
    ).resolves.toEqual([]);
  });

  it("creates three jobs when an L3 brand owes three articles this week", async () => {
    const supabase = new FakeSupabase({
      trendSignals: [
        buildSignal(1, 0.7),
        buildSignal(2, 0.95),
        buildSignal(3, 0.8),
      ],
    });
    const scheduler = buildScheduler({ supabase });

    const jobs = await scheduler.tickWeekly(
      buildBrand({ auto_articles_per_week: 3 }),
    );

    expect(jobs).toHaveLength(3);
    expect(jobs.map((job) => job.keywords)).toEqual([
      ["topic-2"],
      ["topic-3"],
      ["topic-1"],
    ]);
    expect(supabase.articleJobs).toHaveLength(3);
    expect(supabase.trendSignals.every((signal) => signal.used_at)).toBe(true);
    expect(jobs.map((job) => job.scheduled_publish_at)).toEqual([
      "2026-05-18T01:00:00.000Z",
      "2026-05-21T06:00:00.000Z",
      "2026-05-24T12:00:00.000Z",
    ]);
  });

  it("creates one job when an L3 brand already created two of three weekly articles", async () => {
    const scheduler = buildScheduler({
      supabase: new FakeSupabase({
        articleJobs: [
          {
            id: "existing-1",
            brand_id: "brand-1",
            created_at: "2026-05-18T02:00:00.000Z",
          },
          {
            id: "existing-2",
            brand_id: "brand-1",
            created_at: "2026-05-19T02:00:00.000Z",
          },
        ],
        trendSignals: [buildSignal(1)],
      }),
    });

    const jobs = await scheduler.tickWeekly(
      buildBrand({ auto_articles_per_week: 3 }),
    );

    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.keywords).toEqual(["topic-1"]);
  });

  it("reports quota_exceeded from tickAllBrands when an L3 brand has no quota remaining", async () => {
    const brand = buildBrand({ id: "brand-1", auto_articles_per_week: 3 });
    const scheduler = buildScheduler({
      supabase: new FakeSupabase({
        brands: [brand as unknown as TableRow],
        trendSignals: [buildSignal(1), buildSignal(2), buildSignal(3)],
      }),
      quota: {
        canConsume: vi.fn(async () => ({
          allowed: false,
          used: 30,
          cap: 30,
          remaining: 0,
          plan: "solo" as const,
          resource: "articles",
        })),
      },
    });

    await expect(scheduler.tickAllBrands()).resolves.toEqual([
      { brandId: "brand-1", created: 0, reason: "quota_exceeded" },
    ]);
  });

  it("marks L4 jobs for downstream social auto-publish", async () => {
    const scheduler = buildScheduler({
      supabase: new FakeSupabase({ trendSignals: [buildSignal(1)] }),
    });

    const jobs = await scheduler.tickWeekly(
      buildBrand({ automation_level: 4, auto_articles_per_week: 1 }),
    );

    expect(jobsMetadata(jobs)).toEqual([
      expect.objectContaining({ auto_publish_to_social: true }),
    ]);
  });

  it("is idempotent within the same calendar week", async () => {
    const supabase = new FakeSupabase({
      trendSignals: [buildSignal(1), buildSignal(2), buildSignal(3)],
    });
    const scheduler = buildScheduler({ supabase });
    const brand = buildBrand({ auto_articles_per_week: 3 });

    await expect(scheduler.tickWeekly(brand)).resolves.toHaveLength(3);
    await expect(scheduler.tickWeekly(brand)).resolves.toEqual([]);
    expect(supabase.articleJobs).toHaveLength(3);
  });
});
