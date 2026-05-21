export interface BrandMemoryInput {
  voiceTone: string | null;
  targetAudience: Record<string, unknown> | null;
  valueProps: string[] | null;
  brandGuidelines: string | null;
}

export interface BrandPerformanceMemory {
  [metricKey: string]: unknown;
}

export interface BrandMemory extends BrandMemoryInput {
  performance: BrandPerformanceMemory;
}

export interface BrandMemoryStore {
  getMemory(brandId: string): Promise<BrandMemory>;
  updateMemory(brandId: string, key: string, value: unknown): Promise<void>;
  getPromptInjection(brandId: string): Promise<string>;
}

type SupabaseError = { message: string };

type SupabaseQueryResponse = {
  data: unknown;
  count?: number | null;
  error: SupabaseError | null;
};

type SupabaseSingleResponse = {
  data: unknown;
  error: SupabaseError | null;
};

type SupabaseExecutableQuery = PromiseLike<SupabaseQueryResponse>;

type SupabaseFilterQuery = SupabaseExecutableQuery & {
  eq(column: string, value: unknown): SupabaseFilterQuery;
  maybeSingle(): PromiseLike<SupabaseSingleResponse>;
};

type SupabaseQueryBuilder = {
  select(
    columns?: string,
    options?: { count?: "exact"; head?: boolean },
  ): SupabaseFilterQuery;
  upsert(
    payload: unknown,
    options?: { onConflict?: string },
  ): SupabaseExecutableQuery;
};

export interface SupabaseServerClient {
  from(table: string): SupabaseQueryBuilder;
}

type BrandIdentity = BrandMemoryInput & {
  name: string;
};

type BrandRow = {
  name: string;
  voice_tone: string | null;
  target_audience: unknown;
  value_props: unknown;
  brand_guidelines: string | null;
};

type MemoryRow = {
  metric_key: string;
  metric_value: unknown;
};

export const BRAND_MEMORY_WARM_ARTICLE_THRESHOLD = 8;

const BRAND_SELECT =
  "name, voice_tone, target_audience, value_props, brand_guidelines";
const MEMORY_SELECT = "metric_key, metric_value";
const GENERIC_STRUCTURE_BASELINE =
  "Use best-practice structure: hook → context → 3 sub-headings → CTA.";

export function createBrandMemoryStore(deps: {
  supabase: SupabaseServerClient;
}): BrandMemoryStore {
  return {
    async getMemory(brandId: string): Promise<BrandMemory> {
      const [brand, performance] = await Promise.all([
        readBrandIdentity(deps.supabase, brandId),
        readPerformanceMemory(deps.supabase, brandId),
      ]);

      return {
        voiceTone: brand.voiceTone,
        targetAudience: brand.targetAudience,
        valueProps: brand.valueProps,
        brandGuidelines: brand.brandGuidelines,
        performance,
      };
    },

    async updateMemory(
      brandId: string,
      key: string,
      value: unknown,
    ): Promise<void> {
      const metricValue = toJsonCompatibleValue(value);
      const existing = await readMemoryValue(deps.supabase, brandId, key);

      if (
        existing.found &&
        JSON.stringify(existing.value) === JSON.stringify(metricValue)
      ) {
        return;
      }

      const { error } = await deps.supabase
        .from("brand_performance_memory")
        .upsert(
          {
            brand_id: brandId,
            metric_key: key,
            metric_value: metricValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "brand_id,metric_key" },
        );

      if (error) {
        throw new Error(`brand_memory_update_failed: ${error.message}`);
      }
    },

    async getPromptInjection(brandId: string): Promise<string> {
      const [brand, performance, publishedArticleCount] = await Promise.all([
        readBrandIdentity(deps.supabase, brandId),
        readPerformanceMemory(deps.supabase, brandId),
        countPublishedArticles(deps.supabase, brandId),
      ]);

      const identitySection = formatBrandIdentitySection(brand);

      if (publishedArticleCount < BRAND_MEMORY_WARM_ARTICLE_THRESHOLD) {
        return `${identitySection}\n\n${GENERIC_STRUCTURE_BASELINE}`;
      }

      return `${identitySection}\n\n${formatPerformanceSection(performance)}`;
    },
  };
}

async function readBrandIdentity(
  supabase: SupabaseServerClient,
  brandId: string,
): Promise<BrandIdentity> {
  const { data, error } = await supabase
    .from("brands")
    .select(BRAND_SELECT)
    .eq("id", brandId)
    .maybeSingle();

  if (error) {
    throw new Error(`brand_memory_brand_lookup_failed: ${error.message}`);
  }

  if (!isBrandRow(data)) {
    throw new Error("brand_memory_brand_not_found");
  }

  return {
    name: data.name,
    voiceTone: data.voice_tone,
    targetAudience: asRecordOrNull(data.target_audience),
    valueProps: asStringArrayOrNull(data.value_props),
    brandGuidelines: data.brand_guidelines,
  };
}

async function readPerformanceMemory(
  supabase: SupabaseServerClient,
  brandId: string,
): Promise<BrandPerformanceMemory> {
  const { data, error } = await supabase
    .from("brand_performance_memory")
    .select(MEMORY_SELECT)
    .eq("brand_id", brandId);

  if (error) {
    throw new Error(`brand_memory_lookup_failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data.filter(isMemoryRow) : [];

  return rows.reduce<BrandPerformanceMemory>((memory, row) => {
    memory[row.metric_key] = row.metric_value;
    return memory;
  }, {});
}

async function readMemoryValue(
  supabase: SupabaseServerClient,
  brandId: string,
  key: string,
): Promise<{ found: boolean; value: unknown }> {
  const { data, error } = await supabase
    .from("brand_performance_memory")
    .select("metric_value")
    .eq("brand_id", brandId)
    .eq("metric_key", key)
    .maybeSingle();

  if (error) {
    throw new Error(`brand_memory_lookup_failed: ${error.message}`);
  }

  if (!isRecord(data) || !("metric_value" in data)) {
    return { found: false, value: null };
  }

  return { found: true, value: data.metric_value };
}

async function countPublishedArticles(
  supabase: SupabaseServerClient,
  brandId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("generated_articles")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("status", "published");

  if (error) {
    throw new Error(`brand_memory_article_count_failed: ${error.message}`);
  }

  return count ?? 0;
}

function formatBrandIdentitySection(brand: BrandIdentity): string {
  const voiceTone = brand.voiceTone?.trim() || "not specified";
  const targetAudience = summarizeTargetAudience(brand.targetAudience);
  const valueProps = formatValueProps(brand.valueProps);
  const guidelines = truncateForPrompt(
    brand.brandGuidelines?.trim() || "not specified",
    500,
  );

  return [
    `You are writing for the brand "${brand.name}". The brand's voice tone is ${voiceTone}.`,
    `Target audience: ${targetAudience}. Value propositions: ${valueProps}.`,
    `Brand guidelines: ${guidelines}.`,
  ].join("\n");
}

function formatPerformanceSection(performance: BrandPerformanceMemory): string {
  return [
    "Based on past performance, prefer:",
    `- Topic categories: ${formatTopicCategories(
      performance.best_topic_categories,
    )}`,
    `- Article length: ${
      scalarToPromptText(performance.optimal_length) ?? "flexible"
    }`,
    `- CTA style: ${
      scalarToPromptText(performance.best_cta_style) ?? "soft-suggestion"
    }`,
    `- Publish hour: ${
      scalarToPromptText(performance.best_publish_hour) ?? "flexible"
    } (TW timezone)`,
  ].join("\n");
}

function summarizeTargetAudience(
  targetAudience: Record<string, unknown> | null,
): string {
  if (!targetAudience) return "general audience";

  const description = stringValue(targetAudience.description);
  if (description) return description;

  const audience = stringValue(targetAudience.audience);
  if (audience) return audience;

  const summaryParts = Object.entries(targetAudience)
    .map(([key, value]) => {
      const summary = summarizeAudienceValue(value);
      return summary ? `${humanizeKey(key)}: ${summary}` : null;
    })
    .filter((part): part is string => Boolean(part));

  return summaryParts.length > 0 ? summaryParts.join("; ") : "general audience";
}

function summarizeAudienceValue(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const values = value
      .map(summarizeAudienceValue)
      .filter((item): item is string => Boolean(item));
    return values.length > 0 ? values.join(", ") : null;
  }
  if (isRecord(value)) {
    const values = Object.entries(value)
      .map(([key, nestedValue]) => {
        const summary = summarizeAudienceValue(nestedValue);
        return summary ? `${humanizeKey(key)} ${summary}` : null;
      })
      .filter((item): item is string => Boolean(item));
    return values.length > 0 ? values.join(", ") : null;
  }

  return null;
}

function formatValueProps(valueProps: string[] | null): string {
  if (!valueProps || valueProps.length === 0) return "not specified";

  return valueProps
    .map((valueProp) => valueProp.trim())
    .filter(Boolean)
    .map((valueProp) => `\n- ${valueProp}`)
    .join("");
}

function formatTopicCategories(value: unknown): string {
  if (Array.isArray(value)) {
    const categories = value
      .map(scalarToPromptText)
      .filter((category): category is string => Boolean(category))
      .slice(0, 5);
    return categories.length > 0 ? categories.join(", ") : "flexible";
  }

  return scalarToPromptText(value) ?? "flexible";
}

function scalarToPromptText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function truncateForPrompt(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase();
}

function toJsonCompatibleValue(value: unknown): unknown {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new Error("brand_memory_value_not_json_serializable");
  }

  return JSON.parse(serialized) as unknown;
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const strings = value.filter(
    (item): item is string => typeof item === "string",
  );
  return strings.length > 0 ? strings : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isBrandRow(value: unknown): value is BrandRow {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    (typeof value.voice_tone === "string" || value.voice_tone === null) &&
    (typeof value.brand_guidelines === "string" ||
      value.brand_guidelines === null)
  );
}

function isMemoryRow(value: unknown): value is MemoryRow {
  return (
    isRecord(value) &&
    typeof value.metric_key === "string" &&
    "metric_value" in value
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
