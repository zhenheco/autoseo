import type { Brand } from "@/lib/brands/active-brand";
import type { QuotaEnforcer } from "@/lib/quota/enforcer";
import { getGoldenSlotsForDate } from "@/lib/scheduling/golden-slots";
import type {
  TrendSignal,
  TrendSignalSource,
  TrendsAggregator,
} from "@/lib/trends/aggregator";
import type { Database, Json } from "@/types/database.types";

export type ArticleJob = Database["public"]["Tables"]["article_jobs"]["Row"];

type SupabaseError = { message?: string };
type SupabaseResult<T = unknown> = {
  data?: T | null;
  count?: number | null;
  error?: SupabaseError | null;
};
type SupabaseExecutableQuery<T = unknown> = PromiseLike<SupabaseResult<T>>;
type SupabaseQueryBuilder<T = unknown> = SupabaseExecutableQuery<T> & {
  select(
    columns?: string,
    options?: { count?: "exact"; head?: boolean },
  ): SupabaseQueryBuilder<T>;
  insert(values: unknown): SupabaseQueryBuilder<T>;
  update(values: unknown): SupabaseQueryBuilder<T>;
  eq(column: string, value: unknown): SupabaseQueryBuilder<T>;
  gte(column: string, value: unknown): SupabaseQueryBuilder<T>;
  lte(column: string, value: unknown): SupabaseQueryBuilder<T>;
  is(column: string, value: unknown): SupabaseQueryBuilder<T>;
  or(filters: string): SupabaseQueryBuilder<T>;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SupabaseQueryBuilder<T>;
  limit(count: number): SupabaseQueryBuilder<T>;
  single<R = T>(): PromiseLike<SupabaseResult<R>>;
  maybeSingle<R = T>(): PromiseLike<SupabaseResult<R>>;
};

export interface SupabaseServerClient {
  from(table: string): SupabaseQueryBuilder;
}

export interface AutomationScheduler {
  tickWeekly(brand: Brand): Promise<ArticleJob[]>;
  tickAllBrands(): Promise<
    { brandId: string; created: number; reason?: string }[]
  >;
}

type TrendSignalRow = {
  id: string;
  brand_id: string;
  topic: string;
  source: TrendSignalSource;
  confidence: number | string;
  metadata: Record<string, unknown> | null;
  expires_at?: string | null;
  used_at?: string | null;
};

type SchedulerOutcome = {
  jobs: ArticleJob[];
  reason?: string;
};

const AUTO_ARTICLES_PER_WEEK_CAP = 14;
const SCHEDULER_SOURCE = "automation_scheduler";

export function createAutomationScheduler(deps: {
  supabase: SupabaseServerClient;
  quotaEnforcer: QuotaEnforcer;
  trendsAggregator: TrendsAggregator;
  now?: () => Date;
}): AutomationScheduler {
  const now = deps.now ?? (() => new Date());

  async function tickWeeklyWithReason(brand: Brand): Promise<SchedulerOutcome> {
    if (brand.automation_level < 3) {
      return { jobs: [] };
    }

    const target = normalizeWeeklyTarget(brand.auto_articles_per_week);
    if (target === 0) {
      return { jobs: [], reason: "target_zero" };
    }

    const week = calendarWeekBounds(now());
    const alreadyCreated = await countCreatedThisWeek(
      deps.supabase,
      brand.id,
      week,
    );
    const deficit = target - alreadyCreated;

    if (deficit <= 0) {
      return { jobs: [], reason: "target_met" };
    }

    const quota = await deps.quotaEnforcer.canConsume(
      brand.company_id,
      "articles",
      deficit,
    );
    const createCount = quota.allowed
      ? deficit
      : Math.min(deficit, Math.max(quota.remaining, 0));

    if (!quota.allowed) {
      console.warn("[AutomationScheduler] Weekly quota constrained", {
        brandId: brand.id,
        companyId: brand.company_id,
        requested: deficit,
        allowed: createCount,
        remaining: quota.remaining,
      });
    }

    if (createCount <= 0) {
      return { jobs: [], reason: "quota_exceeded" };
    }

    const signals = await getAvailableTrendSignals(brand, createCount, deps);
    if (signals.length === 0) {
      return { jobs: [], reason: "no_trend_signals" };
    }

    const selectedSignals = signals.slice(0, createCount);
    const scheduledSlots = spreadAcrossGoldenSlots(
      week.start,
      week.end,
      now(),
      selectedSignals.length,
    );
    const jobs = await insertArticleJobs({
      supabase: deps.supabase,
      brand,
      signals: selectedSignals,
      scheduledSlots,
    });

    await markSignalsUsed(
      deps.supabase,
      selectedSignals.map((signal) => signal.id),
      now(),
    );

    return { jobs };
  }

  return {
    async tickWeekly(brand) {
      const outcome = await tickWeeklyWithReason(brand);
      return outcome.jobs;
    },

    async tickAllBrands() {
      const brands = await readAutomatedBrands(deps.supabase);
      const results: { brandId: string; created: number; reason?: string }[] =
        [];

      for (const brand of brands) {
        const outcome = await tickWeeklyWithReason(brand);
        results.push({
          brandId: brand.id,
          created: outcome.jobs.length,
          ...(outcome.reason ? { reason: outcome.reason } : {}),
        });
      }

      return results;
    },
  };
}

function normalizeWeeklyTarget(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(AUTO_ARTICLES_PER_WEEK_CAP, Math.floor(value)));
}

function calendarWeekBounds(reference: Date) {
  const start = new Date(reference);
  start.setUTCHours(0, 0, 0, 0);

  const day = start.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

async function countCreatedThisWeek(
  supabase: SupabaseServerClient,
  brandId: string,
  week: { start: Date; end: Date },
): Promise<number> {
  const { count, error } = await supabase
    .from("article_jobs")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .gte("created_at", week.start.toISOString())
    .lte("created_at", week.end.toISOString());

  if (error) {
    throw new Error(error.message || "automation_weekly_count_failed");
  }

  return count ?? 0;
}

async function getAvailableTrendSignals(
  brand: Brand,
  limit: number,
  deps: {
    supabase: SupabaseServerClient;
    trendsAggregator: TrendsAggregator;
  },
): Promise<TrendSignalRow[]> {
  const existing = await readUnusedTrendSignals(deps.supabase, brand.id, limit);

  if (existing.length >= limit) {
    return existing;
  }

  await refreshTrendSignals(brand, deps);
  return readUnusedTrendSignals(deps.supabase, brand.id, limit);
}

async function readUnusedTrendSignals(
  supabase: SupabaseServerClient,
  brandId: string,
  limit: number,
): Promise<TrendSignalRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("trend_signals")
    .select("id, brand_id, topic, source, confidence, metadata, expires_at")
    .eq("brand_id", brandId)
    .is("used_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("confidence", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message || "automation_trend_signal_lookup_failed");
  }

  return Array.isArray(data) ? data.flatMap(toTrendSignalRow) : [];
}

async function refreshTrendSignals(
  brand: Brand,
  deps: {
    supabase: SupabaseServerClient;
    trendsAggregator: TrendsAggregator;
  },
): Promise<void> {
  const keywords = await readBrandKeywords(deps.supabase, brand);
  const signals = await deps.trendsAggregator.fetchTrends({
    id: brand.id,
    keywords,
  });

  const rows = signals.flatMap((signal) =>
    toTrendSignalInsert(brand.id, signal, new Date()),
  );

  if (rows.length === 0) return;

  const { error } = await deps.supabase.from("trend_signals").insert(rows);
  if (error) {
    throw new Error(error.message || "automation_trend_signal_insert_failed");
  }
}

async function readBrandKeywords(
  supabase: SupabaseServerClient,
  brand: Brand,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("brand_keywords")
    .select("keyword")
    .eq("brand_id", brand.id)
    .order("priority", { ascending: false });

  if (error) {
    throw new Error(error.message || "automation_brand_keywords_failed");
  }

  const keywords = Array.isArray(data)
    ? data.flatMap((row) =>
        isRecord(row) && typeof row.keyword === "string" ? [row.keyword] : [],
      )
    : [];

  return keywords.length > 0 ? keywords : [brand.name];
}

function toTrendSignalInsert(
  brandId: string,
  signal: TrendSignal,
  reference: Date,
) {
  const topic = signal.topic.trim();
  if (!topic) return [];

  return [
    {
      brand_id: brandId,
      topic,
      source: signal.source,
      confidence: clampConfidence(signal.confidence),
      metadata: signal.metadata,
      signal_date: reference.toISOString().slice(0, 10),
    },
  ];
}

async function insertArticleJobs(input: {
  supabase: SupabaseServerClient;
  brand: Brand;
  signals: TrendSignalRow[];
  scheduledSlots: Date[];
}): Promise<ArticleJob[]> {
  const rows = input.signals.map((signal, index) => ({
    company_id: input.brand.company_id,
    brand_id: input.brand.id,
    keywords: [signal.topic],
    article_type: "blog",
    status: "pending",
    scheduled_publish_at:
      input.scheduledSlots[index]?.toISOString() ??
      input.scheduledSlots.at(-1)?.toISOString() ??
      null,
    source_type: SCHEDULER_SOURCE,
    metadata: buildArticleJobMetadata(input.brand, signal),
  }));

  const { data, error } = await input.supabase
    .from("article_jobs")
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(error.message || "automation_article_job_insert_failed");
  }

  return Array.isArray(data) ? (data as ArticleJob[]) : [];
}

function buildArticleJobMetadata(brand: Brand, signal: TrendSignalRow): Json {
  const metadata: Record<string, Json | undefined> = {
    source: SCHEDULER_SOURCE,
    trend_signal_id: signal.id,
    trend_topic: signal.topic,
    trend_source: signal.source,
    trend_confidence: Number(signal.confidence),
    trend_metadata: asJsonRecord(signal.metadata),
  };

  if (brand.automation_level >= 4) {
    metadata.auto_publish_to_social = true;
  }

  return metadata;
}

async function markSignalsUsed(
  supabase: SupabaseServerClient,
  signalIds: string[],
  reference: Date,
): Promise<void> {
  await Promise.all(
    signalIds.map(async (id) => {
      const { error } = await supabase
        .from("trend_signals")
        .update({ used_at: reference.toISOString() })
        .eq("id", id);

      if (error) {
        throw new Error(error.message || "automation_mark_signal_used_failed");
      }
    }),
  );
}

async function readAutomatedBrands(
  supabase: SupabaseServerClient,
): Promise<Brand[]> {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .gte("automation_level", 3)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "automation_brand_lookup_failed");
  }

  return Array.isArray(data) ? (data as Brand[]) : [];
}

function spreadAcrossGoldenSlots(
  weekStart: Date,
  weekEnd: Date,
  reference: Date,
  count: number,
): Date[] {
  if (count <= 0) return [];

  const slots = weeklyGoldenSlots(weekStart, weekEnd).filter(
    (slot) => slot >= reference,
  );
  const sourceSlots =
    slots.length >= count ? slots : [...slots, ...futureGoldenSlots(weekEnd)];

  if (count === 1) {
    return sourceSlots.slice(0, 1);
  }

  const lastIndex = sourceSlots.length - 1;
  return Array.from({ length: count }, (_, index) => {
    const slotIndex = Math.round((index * lastIndex) / (count - 1));
    return sourceSlots[slotIndex] ?? sourceSlots[0] ?? new Date(reference);
  });
}

function weeklyGoldenSlots(weekStart: Date, weekEnd: Date): Date[] {
  const slots: Date[] = [];

  for (
    let date = new Date(weekStart);
    date <= weekEnd;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    slots.push(...getGoldenSlotsForDate(date));
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

function futureGoldenSlots(after: Date): Date[] {
  const slots: Date[] = [];
  const start = new Date(after);
  start.setUTCDate(start.getUTCDate() + 1);
  start.setUTCHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + dayOffset);
    slots.push(...getGoldenSlotsForDate(date));
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

function toTrendSignalRow(value: unknown): TrendSignalRow[] {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.brand_id !== "string" ||
    typeof value.topic !== "string" ||
    typeof value.source !== "string"
  ) {
    return [];
  }

  return [
    {
      id: value.id,
      brand_id: value.brand_id,
      topic: value.topic,
      source: value.source as TrendSignalSource,
      confidence:
        typeof value.confidence === "number" ||
        typeof value.confidence === "string"
          ? value.confidence
          : 0.5,
      metadata: asRecord(value.metadata),
      expires_at:
        typeof value.expires_at === "string" || value.expires_at === null
          ? value.expires_at
          : null,
      used_at:
        typeof value.used_at === "string" || value.used_at === null
          ? value.used_at
          : null,
    },
  ];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asJsonRecord(value: unknown): Json | undefined {
  if (!isRecord(value)) return undefined;

  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => isJsonValue(entry)),
  ) as Json;
}

function isJsonValue(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0.5;
  return Math.max(0, Math.min(1, confidence));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
