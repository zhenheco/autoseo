import { describe, expect, it, vi } from "vitest";
import {
  persistSignals,
  type SupabaseServerClient,
} from "../../../src/lib/trends/persistence";
import type { TrendSignal } from "../../../src/lib/trends/aggregator";
import { runTrendsResearch } from "../trends-research";

type StoredSignal = {
  id: string;
  brand_id: string;
  topic: string;
  source: TrendSignal["source"];
  signal_date: string;
};

function createTrendSignalsStore() {
  const rows: StoredSignal[] = [];

  const supabase = {
    from(table: string) {
      if (table !== "trend_signals") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const filters = new Map<string, unknown>();
      const selectBuilder = {
        eq(column: string, value: unknown) {
          filters.set(column, value);
          return selectBuilder;
        },
        async in(column: string, values: unknown[]) {
          return {
            data: rows
              .filter((row) => row.brand_id === filters.get("brand_id"))
              .filter((row) => row.signal_date === filters.get("signal_date"))
              .filter((row) =>
                values.includes(row[column as keyof StoredSignal]),
              )
              .map((row) => ({ topic: row.topic, source: row.source })),
            error: null,
          };
        },
      };

      return {
        select() {
          return selectBuilder;
        },
        async upsert(values: unknown) {
          const inserted: Array<{ id: string }> = [];

          for (const value of values as Array<Omit<StoredSignal, "id">>) {
            const exists = rows.some(
              (row) =>
                row.brand_id === value.brand_id &&
                row.topic === value.topic &&
                row.source === value.source &&
                row.signal_date === value.signal_date,
            );

            if (!exists) {
              const id = `signal-${rows.length + 1}`;
              rows.push({ ...value, id });
              inserted.push({ id });
            }
          }

          return { data: inserted, error: null };
        },
      };
    },
  } as unknown as SupabaseServerClient;

  return { rows, supabase };
}

describe("runTrendsResearch", () => {
  it("does not duplicate same-day signals when rerun", async () => {
    const store = createTrendSignalsStore();
    const aggregator = {
      fetchTrends: vi.fn(async () => [
        { topic: "AI SEO workflows", source: "perplexity", confidence: 0.9 },
        { topic: "Search console automation", source: "gsc", confidence: 0.8 },
      ]),
    };

    const deps = {
      loadBrandsWithKeywords: vi.fn(async () => [
        {
          id: "brand-1",
          name: "Demo brand",
          keywords: ["seo", "automation"],
        },
      ]),
      aggregator,
      persistSignals: (brandId: string, signals: TrendSignal[]) =>
        persistSignals(brandId, signals, { supabase: store.supabase }),
      logger: {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    };

    const firstRun = await runTrendsResearch(deps);
    const secondRun = await runTrendsResearch(deps);

    expect(firstRun.totals).toMatchObject({ inserted: 2, skipped: 0 });
    expect(secondRun.totals).toMatchObject({ inserted: 0, skipped: 2 });
    expect(store.rows).toHaveLength(2);
    expect(aggregator.fetchTrends).toHaveBeenCalledTimes(2);
  });
});
