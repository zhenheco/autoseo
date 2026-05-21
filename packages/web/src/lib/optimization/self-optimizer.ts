import type {
  BrandMemoryStore,
  SupabaseServerClient as BrandMemorySupabaseServerClient,
} from "@/lib/brands/memory-store";

export type SupabaseServerClient = BrandMemorySupabaseServerClient;

export interface SelfOptimizer {
  optimize(brandId: string): Promise<OptimizationResult>;
  optimizeAll(): Promise<
    { brandId: string; metricsUpdated: number; coldStart?: boolean }[]
  >;
}

export interface OptimizationResult {
  brandId: string;
  metricsUpdated: number;
  coldStart: boolean;
  topPerformerIds: string[];
}

export interface LLMClient {
  complete(
    prompt: string,
    options: {
      model: string;
      temperature?: number;
      maxTokens?: number;
      format?: "text" | "json";
      responseFormat?: { type: "json_object" };
    },
  ): Promise<{
    content: string;
    model?: string;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  }>;
}

type Logger = Pick<typeof console, "error" | "log" | "warn">;

type SupabaseError = { message?: string };

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type SupabaseQuery<T> = PromiseLike<SupabaseResult<T[]>> & {
  select(columns?: string, options?: Record<string, unknown>): SupabaseQuery<T>;
  eq(column: string, value: unknown): SupabaseQuery<T>;
  is(column: string, value: unknown): SupabaseQuery<T>;
  gte(column: string, value: unknown): SupabaseQuery<T>;
  in(column: string, values: unknown[]): SupabaseQuery<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseQuery<T>;
  maybeSingle(): PromiseLike<SupabaseResult<T | null>>;
};

type OptimizerSupabaseClient = {
  from<T = unknown>(table: string): SupabaseQuery<T>;
};

type BrandRow = {
  id: string;
  name: string;
  deleted_at?: string | null;
};

type ArticleRow = {
  id: string;
  brand_id: string | null;
  status: string | null;
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

type TopArticle = {
  id: string;
  title: string;
  pageviews: number;
  categories: string[];
  wordCount: number | null;
  publishHour: number | null;
};

type LLMOptimizationMemory = {
  best_topic_categories: string[];
  optimal_length: number;
  best_cta_style: string;
  best_publish_hour: number;
};

const COLD_START_PUBLISHED_ARTICLE_THRESHOLD = 8;
const BASELINE_MEMORY = [
  ["best_topic_categories", []],
  ["optimal_length", "1500"],
  ["best_publish_hour", 9],
] as const;
const LLM_MODEL = process.env.SELF_OPTIMIZER_LLM_MODEL || "deepseek-chat";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function createSelfOptimizer(deps: {
  supabase: SupabaseServerClient;
  brandMemoryStore: BrandMemoryStore;
  llm: LLMClient;
  logger?: Logger;
}): SelfOptimizer {
  const supabase = deps.supabase as unknown as OptimizerSupabaseClient;
  const logger = deps.logger ?? console;

  return {
    async optimize(brandId: string): Promise<OptimizationResult> {
      const [brand, articles] = await Promise.all([
        loadBrand(supabase, brandId),
        loadPublishedArticles(supabase, brandId),
      ]);

      if (articles.length < COLD_START_PUBLISHED_ARTICLE_THRESHOLD) {
        let metricsUpdated = 0;
        for (const [key, value] of BASELINE_MEMORY) {
          await deps.brandMemoryStore.updateMemory(brandId, key, value);
          metricsUpdated += 1;
        }

        return {
          brandId,
          metricsUpdated,
          coldStart: true,
          topPerformerIds: [],
        };
      }

      const performanceRows = await loadRecentPerformanceRows(
        supabase,
        articles.map((article) => article.id),
      );
      const topArticles = selectTopPerformers(articles, performanceRows);
      const prompt = buildOptimizationPrompt(brand, topArticles);

      logger.log("[SelfOptimizer] LLM request", {
        brandId,
        prompt: truncateForAudit(prompt),
      });

      const response = await deps.llm.complete(prompt, {
        model: LLM_MODEL,
        temperature: 0.2,
        maxTokens: 800,
        format: "json",
        responseFormat: { type: "json_object" },
      });

      logger.log("[SelfOptimizer] LLM response", {
        brandId,
        response: truncateForAudit(response.content),
      });

      const memory = parseOptimizationMemory(response.content);
      const entries: Array<[keyof LLMOptimizationMemory, unknown]> = [
        ["best_topic_categories", memory.best_topic_categories],
        ["optimal_length", memory.optimal_length],
        ["best_cta_style", memory.best_cta_style],
        ["best_publish_hour", memory.best_publish_hour],
      ];

      let metricsUpdated = 0;
      for (const [key, value] of entries) {
        await deps.brandMemoryStore.updateMemory(brandId, key, value);
        metricsUpdated += 1;
      }

      return {
        brandId,
        metricsUpdated,
        coldStart: false,
        topPerformerIds: topArticles.map((article) => article.id),
      };
    },

    async optimizeAll() {
      const brands = await loadActiveBrands(supabase);
      const results: {
        brandId: string;
        metricsUpdated: number;
        coldStart?: boolean;
      }[] = [];

      for (const brand of brands) {
        try {
          const result = await this.optimize(brand.id);
          results.push({
            brandId: result.brandId,
            metricsUpdated: result.metricsUpdated,
            coldStart: result.coldStart,
          });
        } catch (error) {
          logger.error("[SelfOptimizer] brand failed", {
            brandId: brand.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return results;
    },
  };
}

async function loadBrand(
  supabase: OptimizerSupabaseClient,
  brandId: string,
): Promise<BrandRow> {
  const { data, error } = await supabase
    .from<BrandRow>("brands")
    .select("id, name, deleted_at")
    .eq("id", brandId)
    .maybeSingle();

  if (error) {
    throw new Error(`self_optimizer_brand_lookup_failed: ${error.message}`);
  }
  if (!isBrandRow(data)) {
    throw new Error("self_optimizer_brand_not_found");
  }

  return data;
}

async function loadActiveBrands(
  supabase: OptimizerSupabaseClient,
): Promise<BrandRow[]> {
  const { data, error } = await supabase
    .from<BrandRow>("brands")
    .select("id, name, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`self_optimizer_brand_list_failed: ${error.message}`);
  }

  return (data ?? []).filter(isBrandRow);
}

async function loadPublishedArticles(
  supabase: OptimizerSupabaseClient,
  brandId: string,
): Promise<ArticleRow[]> {
  const { data, error } = await supabase
    .from<ArticleRow>("generated_articles")
    .select("id, brand_id, status, title, categories, word_count, published_at")
    .eq("brand_id", brandId)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`self_optimizer_articles_lookup_failed: ${error.message}`);
  }

  return (data ?? []).filter(isArticleRow);
}

async function loadRecentPerformanceRows(
  supabase: OptimizerSupabaseClient,
  articleIds: string[],
): Promise<PerformanceRow[]> {
  if (articleIds.length === 0) return [];

  const cutoff = new Date(Date.now() - THIRTY_DAYS_MS)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from<PerformanceRow>("article_performance")
    .select("article_id, date, source, pageviews")
    .gte("date", cutoff)
    .in("article_id", articleIds);

  if (error) {
    throw new Error(
      `self_optimizer_performance_lookup_failed: ${error.message}`,
    );
  }

  return (data ?? []).filter(isPerformanceRow);
}

function selectTopPerformers(
  articles: ArticleRow[],
  performanceRows: PerformanceRow[],
): TopArticle[] {
  const pageviewsByArticle = new Map<string, number>();

  for (const row of performanceRows) {
    pageviewsByArticle.set(
      row.article_id,
      (pageviewsByArticle.get(row.article_id) ?? 0) + row.pageviews,
    );
  }

  const topCount = Math.max(1, Math.ceil(articles.length * 0.1));

  return [...articles]
    .sort((left, right) => {
      const pageviewDiff =
        (pageviewsByArticle.get(right.id) ?? 0) -
        (pageviewsByArticle.get(left.id) ?? 0);
      if (pageviewDiff !== 0) return pageviewDiff;
      return String(right.published_at ?? "").localeCompare(
        String(left.published_at ?? ""),
      );
    })
    .slice(0, topCount)
    .map((article) => ({
      id: article.id,
      title: article.title,
      pageviews: pageviewsByArticle.get(article.id) ?? 0,
      categories: article.categories ?? [],
      wordCount: article.word_count,
      publishHour: publishHour(article.published_at),
    }));
}

function buildOptimizationPrompt(brand: BrandRow, topArticles: TopArticle[]) {
  return [
    `These articles performed best for brand ${brand.name}. Identify common features: title patterns, length, CTA style, topic category, publish hour. Return JSON with keys: best_topic_categories (array), optimal_length (number), best_cta_style (string), best_publish_hour (number 0-23).`,
    "Return only valid JSON.",
    "Top articles:",
    ...topArticles.map((article) =>
      [
        `- id: ${article.id}`,
        `title: ${article.title}`,
        `pageviews: ${article.pageviews}`,
        `categories: ${article.categories.join(", ") || "none"}`,
        `word_count: ${article.wordCount ?? "unknown"}`,
        `publish_hour: ${article.publishHour ?? "unknown"}`,
      ].join("; "),
    ),
  ].join("\n");
}

function parseOptimizationMemory(content: string): LLMOptimizationMemory {
  const json = extractJsonObject(content);

  if (!json || !isRecord(json)) {
    throw new Error("self_optimizer_invalid_llm_response");
  }

  const bestTopicCategories = json.best_topic_categories;
  const optimalLength = numericValue(json.optimal_length);
  const bestCtaStyle = json.best_cta_style;
  const bestPublishHour = numericValue(json.best_publish_hour);

  if (
    !Array.isArray(bestTopicCategories) ||
    !bestTopicCategories.every((value) => typeof value === "string") ||
    optimalLength === null ||
    typeof bestCtaStyle !== "string" ||
    bestPublishHour === null ||
    !Number.isInteger(bestPublishHour) ||
    bestPublishHour < 0 ||
    bestPublishHour > 23
  ) {
    throw new Error("self_optimizer_invalid_llm_response");
  }

  return {
    best_topic_categories: bestTopicCategories,
    optimal_length: optimalLength,
    best_cta_style: bestCtaStyle,
    best_publish_hour: bestPublishHour,
  };
}

function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  const json = objectMatch?.[0] ?? candidate;

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function publishHour(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours();
}

function truncateForAudit(value: string): string {
  return value.slice(0, 2000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isBrandRow(value: unknown): value is BrandRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function isArticleRow(value: unknown): value is ArticleRow {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string"
  );
}

function isPerformanceRow(value: unknown): value is PerformanceRow {
  return (
    isRecord(value) &&
    typeof value.article_id === "string" &&
    typeof value.date === "string" &&
    typeof value.source === "string" &&
    typeof value.pageviews === "number"
  );
}
