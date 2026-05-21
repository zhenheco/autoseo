import { beforeEach, describe, expect, it, vi } from "vitest";

type TableName = "brands" | "social_posts";
type Filter = { column: string; value: unknown };

const state = vi.hoisted(() => ({
  companyId: "11111111-1111-4111-8111-111111111111",
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

const brandId = "22222222-2222-4222-8222-222222222222";

class FakeQueryBuilder {
  private filters: Filter[] = [];
  private orderColumn: string | null = null;
  private ascending = true;
  private rangeFrom = 0;
  private rangeTo = Number.POSITIVE_INFINITY;

  constructor(
    private readonly db: FakeSupabaseClient,
    private readonly table: TableName,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
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
    const rows = this.table === "brands" ? this.db.brands : this.db.posts;
    const filtered = rows.filter((row) =>
      this.filters.every(
        (filter) => readPath(row, filter.column) === filter.value,
      ),
    );

    if (this.table === "social_posts" && this.orderColumn) {
      filtered.sort((left, right) => {
        const result = String(readPath(left, this.orderColumn!)).localeCompare(
          String(readPath(right, this.orderColumn!)),
        );
        return this.ascending ? result : -result;
      });
    }

    const count = filtered.length;
    const data =
      this.table === "social_posts"
        ? filtered.slice(this.rangeFrom, this.rangeTo + 1)
        : filtered;
    return { data, error: null, count };
  }
}

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
};

class FakeSupabaseClient {
  constructor(
    readonly brands: Array<Record<string, unknown>>,
    readonly posts: Array<Record<string, unknown>>,
  ) {}

  from(table: TableName) {
    return new FakeQueryBuilder(this, table);
  }
}

function readPath(row: unknown, path: string): unknown {
  const normalized = path.replace("social_accounts.", "social_accounts.");
  return normalized.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, row);
}

describe("GET /api/social-posts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    state.supabase = new FakeSupabaseClient(
      [
        {
          id: brandId,
          company_id: state.companyId,
          deleted_at: null,
        },
      ],
      [
        {
          id: "post-1",
          social_account_id: "account-1",
          scheduled_at: "2026-05-22T09:00:00.000Z",
          published_at: null,
          status: "scheduled",
          content_text: "Scheduled Instagram content",
          metrics: { impressions: 10, engagement: 2 },
          social_accounts: { platform: "instagram", brand_id: brandId },
        },
        {
          id: "post-2",
          social_account_id: "account-2",
          scheduled_at: "2026-05-21T09:00:00.000Z",
          published_at: "2026-05-21T10:00:00.000Z",
          status: "published",
          content_text: "Published X content",
          metrics: { impressions: 20, engagement: 5 },
          social_accounts: { platform: "x", brand_id: brandId },
        },
      ],
    );
  });

  it("returns filtered and paginated posts for the requested brand", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      new Request(
        `https://1wayseo.com/api/social-posts?brandId=${brandId}&status=published&platform=x&limit=1&offset=0`,
      ) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.posts).toEqual([
      expect.objectContaining({
        id: "post-2",
        platform: "x",
        contentSnippet: "Published X content",
        status: "published",
        metrics: { impressions: 20, engagement: 5 },
      }),
    ]);
    expect(body.data.pagination).toEqual({
      limit: 1,
      offset: 0,
      total: 1,
      hasMore: false,
    });
  });
});
