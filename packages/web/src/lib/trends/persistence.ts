import type { TrendSignal } from "./aggregator";

type SupabaseResponse<T> = {
  data?: T | null;
  error?: { code?: string; message?: string } | null;
};

type SupabaseFilterBuilder = {
  eq(column: string, value: unknown): SupabaseFilterBuilder;
  in(column: string, values: unknown[]): PromiseLike<SupabaseResponse<unknown>>;
};

type SupabaseQueryBuilder = {
  select(columns: string): SupabaseFilterBuilder;
  upsert(
    values: unknown,
    options?: Record<string, unknown>,
  ): PromiseLike<SupabaseResponse<unknown>>;
};

export interface SupabaseServerClient {
  from(table: string): SupabaseQueryBuilder;
}

type TrendSignalInsert = {
  brand_id: string;
  topic: string;
  source: TrendSignal["source"];
  confidence: number;
  metadata?: Record<string, unknown>;
  signal_date: string;
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function signalKey(signal: Pick<TrendSignal, "topic" | "source">): string {
  return `${signal.source}\u0000${signal.topic.trim()}`;
}

function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0.5;
  return Math.min(1, Math.max(0, confidence));
}

function isUniqueConstraintError(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}

export async function persistSignals(
  brandId: string,
  signals: TrendSignal[],
  deps: { supabase: SupabaseServerClient },
): Promise<{ inserted: number; skipped: number }> {
  const signalDate = toDateOnly(new Date());
  const uniqueSignals = new Map<string, TrendSignal>();

  for (const signal of signals) {
    const topic = signal.topic.trim();
    if (!topic) continue;
    uniqueSignals.set(signalKey({ ...signal, topic }), { ...signal, topic });
  }

  if (uniqueSignals.size === 0) {
    return { inserted: 0, skipped: signals.length };
  }

  const topics = [...new Set([...uniqueSignals.values()].map((s) => s.topic))];
  const existingResponse = await deps.supabase
    .from("trend_signals")
    .select("topic,source")
    .eq("brand_id", brandId)
    .eq("signal_date", signalDate)
    .in("topic", topics);

  if (existingResponse.error) {
    throw new Error(
      existingResponse.error.message || "Failed to query trend signals",
    );
  }

  const existingRows = Array.isArray(existingResponse.data)
    ? (existingResponse.data as Array<{
        topic?: unknown;
        source?: unknown;
      }>)
    : [];
  const existingKeys = new Set(
    existingRows.flatMap((row) => {
      if (typeof row.topic !== "string" || typeof row.source !== "string") {
        return [];
      }
      return [signalKey({ topic: row.topic, source: row.source as never })];
    }),
  );

  const rows: TrendSignalInsert[] = [...uniqueSignals.values()]
    .filter((signal) => !existingKeys.has(signalKey(signal)))
    .map((signal) => ({
      brand_id: brandId,
      topic: signal.topic,
      source: signal.source,
      confidence: clampConfidence(signal.confidence),
      metadata: signal.metadata,
      signal_date: signalDate,
    }));

  const skippedBeforeUpsert = signals.length - rows.length;

  if (rows.length === 0) {
    return { inserted: 0, skipped: skippedBeforeUpsert };
  }

  const upsertResponse = await deps.supabase
    .from("trend_signals")
    .upsert(rows, {
      onConflict: "brand_id,topic,source,signal_date",
      ignoreDuplicates: true,
    });

  if (upsertResponse.error) {
    if (isUniqueConstraintError(upsertResponse.error)) {
      return { inserted: 0, skipped: signals.length };
    }

    throw new Error(
      upsertResponse.error.message || "Failed to persist trend signals",
    );
  }

  const inserted = Array.isArray(upsertResponse.data)
    ? upsertResponse.data.length
    : rows.length;

  return {
    inserted,
    skipped: signals.length - inserted,
  };
}
