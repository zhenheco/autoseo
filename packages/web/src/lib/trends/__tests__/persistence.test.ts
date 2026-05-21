import { describe, expect, it, vi } from "vitest";
import { persistSignals, type SupabaseServerClient } from "../persistence";
import type { TrendSignal } from "../aggregator";

type ExistingRow = {
  topic: string;
  source: TrendSignal["source"];
};

type UpsertResponse = {
  data: Array<{ id: string }> | null;
  error: { code?: string; message?: string } | null;
};

function createSupabaseMock(options: {
  existing?: ExistingRow[];
  upsertResponse?: UpsertResponse;
}) {
  const calls = {
    select: vi.fn(),
    upsert: vi.fn(),
  };
  const selectBuilder = {
    eq: vi.fn(() => selectBuilder),
    in: vi.fn(async () => ({
      data: options.existing ?? [],
      error: null,
    })),
  };
  const table = {
    select: vi.fn(() => {
      calls.select();
      return selectBuilder;
    }),
    upsert: vi.fn(async (rows: unknown, upsertOptions: unknown) => {
      calls.upsert(rows, upsertOptions);
      return (
        options.upsertResponse ?? {
          data: Array.isArray(rows)
            ? rows.map((_, index) => ({ id: `signal-${index}` }))
            : [],
          error: null,
        }
      );
    }),
  };
  const supabase = {
    from: vi.fn(() => table),
  } as unknown as SupabaseServerClient;

  return { supabase, calls };
}

function buildSignals(count: number): TrendSignal[] {
  return Array.from({ length: count }, (_, index) => ({
    topic: `topic-${index + 1}`,
    source: "perplexity",
    confidence: 0.8,
  }));
}

describe("persistSignals", () => {
  it("inserts five new signals and skips none", async () => {
    const { supabase, calls } = createSupabaseMock({});
    const result = await persistSignals("brand-1", buildSignals(5), {
      supabase,
    });

    expect(result).toEqual({ inserted: 5, skipped: 0 });
    expect(calls.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          brand_id: "brand-1",
          topic: "topic-1",
          source: "perplexity",
          confidence: 0.8,
        }),
      ]),
      {
        ignoreDuplicates: true,
        onConflict: "brand_id,topic,source,signal_date",
      },
    );
  });

  it("skips already inserted same-day same-topic signals", async () => {
    const { supabase, calls } = createSupabaseMock({
      existing: [
        { topic: "topic-2", source: "perplexity" },
        { topic: "topic-4", source: "perplexity" },
      ],
    });

    const result = await persistSignals("brand-1", buildSignals(5), {
      supabase,
    });

    expect(result).toEqual({ inserted: 3, skipped: 2 });
    const [rows] = calls.upsert.mock.calls[0] ?? [];
    expect(rows).toEqual([
      expect.objectContaining({ topic: "topic-1" }),
      expect.objectContaining({ topic: "topic-3" }),
      expect.objectContaining({ topic: "topic-5" }),
    ]);
  });

  it("handles unique-key conflicts gracefully", async () => {
    const { supabase } = createSupabaseMock({
      upsertResponse: {
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      },
    });

    const result = await persistSignals("brand-1", buildSignals(5), {
      supabase,
    });

    expect(result).toEqual({ inserted: 0, skipped: 5 });
  });
});
