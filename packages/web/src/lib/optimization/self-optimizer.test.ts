import { describe, expect, it, vi } from "vitest";
import {
  createSelfOptimizer,
  type LLMClient,
  type SupabaseServerClient,
} from "./self-optimizer";
import type { BrandMemoryStore } from "@/lib/brands/memory-store";

type BrandRow = {
  id: string;
  name: string;
  deleted_at: string | null;
};

type ArticleRow = {
  id: string;
  brand_id: string;
  status: string;
  title: string;
  categories: string[] | null;
  word_count: number | null;
  published_at: string | null;
};

type PerformanceRow = {
  article_id: string;
  date: string;
  source: string;
  pageviews: number;
};

type FakeData = {
  brands: BrandRow[];
  generated_articles: ArticleRow[];
  article_performance: PerformanceRow[];
};

function article(
  id: string,
  brandId: string,
  overrides: Partial<ArticleRow> = {},
): ArticleRow {
  return {
    id,
    brand_id: brandId,
    status: "published",
    title: `Article ${id}`,
    categories: ["SEO"],
    word_count: 1400,
    published_at: "2026-05-10T09:00:00.000Z",
    ...overrides,
  };
}

function createMemoryStore() {
  const writes: Array<{ brandId: string; key: string; value: unknown }> = [];
  const store: BrandMemoryStore = {
    getMemory: vi.fn(),
    getPromptInjection: vi.fn(),
    updateMemory: vi.fn(async (brandId, key, value) => {
      writes.push({ brandId, key, value });
    }),
  };

  return { store, writes };
}

function createLlm(response: string): LLMClient {
  return {
    complete: vi.fn(async () => ({
      content: response,
      model: "deepseek-chat",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    })),
  };
}

describe("SelfOptimizer", () => {
  it("writes baseline memory for a cold-start brand with fewer than 8 published articles", async () => {
    const memory = createMemoryStore();
    const llm = createLlm("{}");
    const optimizer = createSelfOptimizer({
      supabase: createSupabase({
        brands: [{ id: "brand-1", name: "Cold Brand", deleted_at: null }],
        generated_articles: Array.from({ length: 5 }, (_, index) =>
          article(`a-${index + 1}`, "brand-1"),
        ),
        article_performance: [],
      }),
      brandMemoryStore: memory.store,
      llm,
    });

    const result = await optimizer.optimize("brand-1");

    expect(result).toEqual({
      brandId: "brand-1",
      metricsUpdated: 3,
      coldStart: true,
      topPerformerIds: [],
    });
    expect(memory.writes).toEqual([
      { brandId: "brand-1", key: "best_topic_categories", value: [] },
      { brandId: "brand-1", key: "optimal_length", value: "1500" },
      { brandId: "brand-1", key: "best_publish_hour", value: 9 },
    ]);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it("selects warm top performers, asks the LLM for patterns, and writes returned keys", async () => {
    const memory = createMemoryStore();
    const llm = createLlm(
      JSON.stringify({
        best_topic_categories: ["technical SEO", "automation"],
        optimal_length: 1800,
        best_cta_style: "soft demo invitation",
        best_publish_hour: 10,
      }),
    );
    const articles = Array.from({ length: 12 }, (_, index) =>
      article(`a-${index + 1}`, "brand-1", {
        title: `Title ${index + 1}`,
        categories: index === 11 ? ["Automation"] : ["SEO"],
        word_count: 1200 + index * 50,
        published_at: `2026-05-${String(index + 1).padStart(2, "0")}T0${
          index % 10
        }:00:00.000Z`,
      }),
    );
    const optimizer = createSelfOptimizer({
      supabase: createSupabase({
        brands: [{ id: "brand-1", name: "Warm Brand", deleted_at: null }],
        generated_articles: articles,
        article_performance: [
          {
            article_id: "a-12",
            date: "2026-05-15",
            source: "ga4",
            pageviews: 90,
          },
          {
            article_id: "a-12",
            date: "2026-05-15",
            source: "gsc",
            pageviews: 20,
          },
          {
            article_id: "a-7",
            date: "2026-05-15",
            source: "ga4",
            pageviews: 70,
          },
          {
            article_id: "a-4",
            date: "2026-05-15",
            source: "ga4",
            pageviews: 10,
          },
        ],
      }),
      brandMemoryStore: memory.store,
      llm,
    });

    const result = await optimizer.optimize("brand-1");

    expect(result).toEqual({
      brandId: "brand-1",
      metricsUpdated: 4,
      coldStart: false,
      topPerformerIds: ["a-12", "a-7"],
    });
    expect(llm.complete).toHaveBeenCalledTimes(1);
    const prompt = vi.mocked(llm.complete).mock.calls[0][0];
    expect(prompt).toContain(
      "These articles performed best for brand Warm Brand",
    );
    expect(prompt).toContain("Title 12");
    expect(prompt).toContain("pageviews: 110");
    expect(prompt).toContain("Title 7");
    expect(memory.writes).toEqual([
      {
        brandId: "brand-1",
        key: "best_topic_categories",
        value: ["technical SEO", "automation"],
      },
      { brandId: "brand-1", key: "optimal_length", value: 1800 },
      {
        brandId: "brand-1",
        key: "best_cta_style",
        value: "soft demo invitation",
      },
      { brandId: "brand-1", key: "best_publish_hour", value: 10 },
    ]);
  });

  it("throws on a single-brand LLM error but optimizeAll logs and continues", async () => {
    const memory = createMemoryStore();
    const llm: LLMClient = {
      complete: vi.fn(async () => {
        throw new Error("llm unavailable");
      }),
    };
    const logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const supabase = createSupabase({
      brands: [
        { id: "brand-err", name: "Error Brand", deleted_at: null },
        { id: "brand-ok", name: "Cold Brand", deleted_at: null },
      ],
      generated_articles: [
        ...Array.from({ length: 12 }, (_, index) =>
          article(`err-${index + 1}`, "brand-err"),
        ),
        ...Array.from({ length: 5 }, (_, index) =>
          article(`ok-${index + 1}`, "brand-ok"),
        ),
      ],
      article_performance: [
        {
          article_id: "err-1",
          date: "2026-05-15",
          source: "ga4",
          pageviews: 50,
        },
      ],
    });

    const optimizer = createSelfOptimizer({
      supabase,
      brandMemoryStore: memory.store,
      llm,
      logger,
    });

    await expect(optimizer.optimize("brand-err")).rejects.toThrow(
      "llm unavailable",
    );

    const result = await optimizer.optimizeAll();

    expect(result).toEqual([
      { brandId: "brand-ok", metricsUpdated: 3, coldStart: true },
    ]);
    expect(logger.error).toHaveBeenCalledWith(
      "[SelfOptimizer] brand failed",
      expect.objectContaining({ brandId: "brand-err" }),
    );
  });

  it("writes the same memory keys and values when rerun with the same LLM response", async () => {
    const memory = createMemoryStore();
    const optimizer = createSelfOptimizer({
      supabase: createSupabase({
        brands: [{ id: "brand-1", name: "Warm Brand", deleted_at: null }],
        generated_articles: Array.from({ length: 12 }, (_, index) =>
          article(`a-${index + 1}`, "brand-1"),
        ),
        article_performance: [
          {
            article_id: "a-1",
            date: "2026-05-15",
            source: "ga4",
            pageviews: 100,
          },
        ],
      }),
      brandMemoryStore: memory.store,
      llm: createLlm(
        JSON.stringify({
          best_topic_categories: ["SEO"],
          optimal_length: 1600,
          best_cta_style: "newsletter signup",
          best_publish_hour: 9,
        }),
      ),
    });

    await optimizer.optimize("brand-1");
    const firstRun = [...memory.writes];
    memory.writes.length = 0;

    await optimizer.optimize("brand-1");

    expect(memory.writes).toEqual(firstRun);
  });
});

class FakeQuery {
  private filters: Array<{ column: string; value: unknown; op: "eq" | "is" }> =
    [];
  private inFilter: { column: string; values: unknown[] } | null = null;
  private gteFilter: { column: string; value: unknown } | null = null;
  private orderBy: { column: string; ascending: boolean } | null = null;

  constructor(
    private table: keyof FakeData,
    private data: FakeData,
  ) {}

  select() {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push({ column, value, op: "is" });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.inFilter = { column, values };
    return this;
  }

  gte(column: string, value: unknown) {
    this.gteFilter = { column, value };
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  maybeSingle() {
    return this.execute().then((result) => ({
      data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data,
      error: result.error,
    }));
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown[];
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute(): Promise<{ data: unknown[]; error: null }> {
    let rows = [...this.data[this.table]];

    for (const filter of this.filters) {
      rows = rows.filter(
        (row) =>
          (row as Record<string, unknown>)[filter.column] === filter.value,
      );
    }

    if (this.inFilter) {
      rows = rows.filter((row) =>
        this.inFilter?.values.includes(
          (row as Record<string, unknown>)[this.inFilter.column],
        ),
      );
    }

    if (this.gteFilter) {
      rows = rows.filter(
        (row) =>
          String((row as Record<string, unknown>)[this.gteFilter!.column]) >=
          String(this.gteFilter!.value),
      );
    }

    if (this.orderBy) {
      rows.sort((left, right) => {
        const leftValue = String(
          (left as Record<string, unknown>)[this.orderBy!.column] ?? "",
        );
        const rightValue = String(
          (right as Record<string, unknown>)[this.orderBy!.column] ?? "",
        );
        return this.orderBy!.ascending
          ? leftValue.localeCompare(rightValue)
          : rightValue.localeCompare(leftValue);
      });
    }

    return { data: rows, error: null };
  }
}

function createSupabase(data: FakeData): SupabaseServerClient {
  return {
    from(table: string) {
      if (!(table in data)) throw new Error(`Unexpected table: ${table}`);
      return new FakeQuery(table as keyof FakeData, data) as never;
    },
  };
}
