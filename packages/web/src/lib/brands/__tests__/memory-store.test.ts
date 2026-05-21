import { describe, expect, it } from "vitest";
import {
  BRAND_MEMORY_WARM_ARTICLE_THRESHOLD,
  createBrandMemoryStore,
  type SupabaseServerClient,
} from "../memory-store";

type BrandRow = {
  id: string;
  name: string;
  voice_tone: string | null;
  target_audience: Record<string, unknown> | null;
  value_props: string[] | null;
  brand_guidelines: string | null;
};

type MemoryRow = {
  brand_id: string;
  metric_key: string;
  metric_value: unknown;
  updated_at: string;
};

type ArticleRow = {
  brand_id: string;
  status: string;
};

type QueryResponse = {
  data: unknown;
  count?: number | null;
  error: { message: string } | null;
};

class FakeQuery implements PromiseLike<QueryResponse> {
  private readonly filters: Array<{ column: string; value: unknown }> = [];
  private selectedColumns = "*";
  private head = false;
  private countMode: "exact" | null = null;
  private upsertPayload: unknown = null;

  constructor(
    private readonly table: string,
    private readonly db: FakeSupabase,
  ) {}

  select(
    columns = "*",
    options?: { count?: "exact"; head?: boolean },
  ): FakeQuery {
    this.selectedColumns = columns;
    this.countMode = options?.count ?? null;
    this.head = options?.head ?? false;
    return this;
  }

  eq(column: string, value: unknown): FakeQuery {
    this.filters.push({ column, value });
    return this;
  }

  upsert(payload: unknown, _options?: unknown): FakeQuery {
    this.upsertPayload = payload;
    return this;
  }

  async maybeSingle(): Promise<QueryResponse> {
    const response = await this.resolve();
    const rows = Array.isArray(response.data) ? response.data : [];
    return {
      data: rows[0] ?? null,
      error: response.error,
    };
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private async resolve(): Promise<QueryResponse> {
    if (this.table === "brand_performance_memory" && this.upsertPayload) {
      this.db.upsertMemory(this.upsertPayload);
      return { data: null, error: null };
    }

    const rows = this.db.selectRows(this.table, this.filters);

    if (this.countMode === "exact" && this.head) {
      return { data: null, count: rows.length, error: null };
    }

    return {
      data: rows.map((row) => this.project(row)),
      error: null,
    };
  }

  private project(row: Record<string, unknown>): Record<string, unknown> {
    if (this.selectedColumns === "*") return row;

    return this.selectedColumns
      .split(",")
      .map((column) => column.trim())
      .filter(Boolean)
      .reduce<Record<string, unknown>>((projected, column) => {
        projected[column] = row[column];
        return projected;
      }, {});
  }
}

class FakeSupabase {
  readonly brands = new Map<string, BrandRow>();
  readonly memory = new Map<string, MemoryRow>();
  readonly articles: ArticleRow[] = [];
  upsertCount = 0;

  from(table: string): FakeQuery {
    return new FakeQuery(table, this);
  }

  selectRows(
    table: string,
    filters: Array<{ column: string; value: unknown }>,
  ): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] =
      table === "brands"
        ? Array.from(this.brands.values()).map((row) => ({ ...row }))
        : table === "brand_performance_memory"
          ? Array.from(this.memory.values()).map((row) => ({ ...row }))
          : table === "generated_articles"
            ? this.articles.map((row) => ({ ...row }))
            : [];

    return rows
      .filter((row) =>
        filters.every((filter) => row[filter.column] === filter.value),
      )
      .map((row) => row);
  }

  upsertMemory(payload: unknown): void {
    if (!isMemoryUpsertPayload(payload)) {
      throw new Error("invalid test payload");
    }

    this.upsertCount += 1;
    this.memory.set(`${payload.brand_id}:${payload.metric_key}`, {
      brand_id: payload.brand_id,
      metric_key: payload.metric_key,
      metric_value: payload.metric_value,
      updated_at: payload.updated_at,
    });
  }
}

function isMemoryUpsertPayload(payload: unknown): payload is MemoryRow {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "brand_id" in payload &&
    "metric_key" in payload &&
    "metric_value" in payload &&
    "updated_at" in payload &&
    typeof payload.brand_id === "string" &&
    typeof payload.metric_key === "string" &&
    typeof payload.updated_at === "string"
  );
}

function createStoreFixture() {
  const supabase = new FakeSupabase();
  supabase.brands.set("brand-1", {
    id: "brand-1",
    name: "Acme SEO",
    voice_tone: "practical and concise",
    target_audience: {
      segment: "Taiwan founders",
      needs: ["SEO growth", "repeatable publishing"],
    },
    value_props: ["Fast strategy", "Reliable content operations"],
    brand_guidelines: "Avoid hype. Prefer concrete examples.",
  });

  return {
    supabase,
    store: createBrandMemoryStore({
      supabase: supabase as unknown as SupabaseServerClient,
    }),
  };
}

function addPublishedArticles(supabase: FakeSupabase, count: number): void {
  for (let index = 0; index < count; index += 1) {
    supabase.articles.push({
      brand_id: "brand-1",
      status: "published",
    });
  }
}

describe("Brand Memory Store", () => {
  it("omits performance preferences during cold start", async () => {
    const { supabase, store } = createStoreFixture();
    addPublishedArticles(supabase, BRAND_MEMORY_WARM_ARTICLE_THRESHOLD - 1);
    supabase.memory.set("brand-1:best_cta_style", {
      brand_id: "brand-1",
      metric_key: "best_cta_style",
      metric_value: "direct-demo",
      updated_at: "2026-05-21T00:00:00.000Z",
    });

    const injection = await store.getPromptInjection("brand-1");

    expect(injection).toContain('You are writing for the brand "Acme SEO"');
    expect(injection).toContain("Use best-practice structure");
    expect(injection).toContain("hook → context → 3 sub-headings → CTA");
    expect(injection).not.toContain("Based on past performance");
    expect(injection).not.toContain("direct-demo");
  });

  it("includes performance bullets for warm brands", async () => {
    const { supabase, store } = createStoreFixture();
    addPublishedArticles(supabase, BRAND_MEMORY_WARM_ARTICLE_THRESHOLD);
    supabase.memory.set("brand-1:best_topic_categories", {
      brand_id: "brand-1",
      metric_key: "best_topic_categories",
      metric_value: ["technical seo", "content ops"],
      updated_at: "2026-05-21T00:00:00.000Z",
    });
    supabase.memory.set("brand-1:optimal_length", {
      brand_id: "brand-1",
      metric_key: "optimal_length",
      metric_value: "1400-1800 words",
      updated_at: "2026-05-21T00:00:00.000Z",
    });
    supabase.memory.set("brand-1:best_cta_style", {
      brand_id: "brand-1",
      metric_key: "best_cta_style",
      metric_value: "soft demo invitation",
      updated_at: "2026-05-21T00:00:00.000Z",
    });
    supabase.memory.set("brand-1:best_publish_hour", {
      brand_id: "brand-1",
      metric_key: "best_publish_hour",
      metric_value: 10,
      updated_at: "2026-05-21T00:00:00.000Z",
    });

    const injection = await store.getPromptInjection("brand-1");

    expect(injection).toContain("Based on past performance, prefer:");
    expect(injection).toContain(
      "- Topic categories: technical seo, content ops",
    );
    expect(injection).toContain("- Article length: 1400-1800 words");
    expect(injection).toContain("- CTA style: soft demo invitation");
    expect(injection).toContain("- Publish hour: 10 (TW timezone)");
  });

  it("writes memory and reads it back from getMemory", async () => {
    const { store } = createStoreFixture();

    await store.updateMemory("brand-1", "best_cta_style", {
      style: "soft-suggestion",
    });

    await expect(store.getMemory("brand-1")).resolves.toMatchObject({
      performance: {
        best_cta_style: {
          style: "soft-suggestion",
        },
      },
    });
  });

  it("does not bump updated_at when writing the same JSON value twice", async () => {
    const { supabase, store } = createStoreFixture();

    await store.updateMemory("brand-1", "optimal_length", "1200 words");
    const firstUpdatedAt = supabase.memory.get(
      "brand-1:optimal_length",
    )?.updated_at;
    await store.updateMemory("brand-1", "optimal_length", "1200 words");
    const secondUpdatedAt = supabase.memory.get(
      "brand-1:optimal_length",
    )?.updated_at;

    expect(supabase.upsertCount).toBe(1);
    expect(secondUpdatedAt).toBe(firstUpdatedAt);
  });

  it("returns a BrandMemory object with an empty performance object", async () => {
    const { store } = createStoreFixture();

    await expect(store.getMemory("brand-1")).resolves.toEqual({
      voiceTone: "practical and concise",
      targetAudience: {
        segment: "Taiwan founders",
        needs: ["SEO growth", "repeatable publishing"],
      },
      valueProps: ["Fast strategy", "Reliable content operations"],
      brandGuidelines: "Avoid hype. Prefer concrete examples.",
      performance: {},
    });
  });
});
