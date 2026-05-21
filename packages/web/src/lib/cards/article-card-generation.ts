import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueOpsAlertEmail } from "@/lib/email/cf-email-client";
import { getR2Config, R2Client } from "@/lib/storage/r2-client";

export const DEFAULT_CARD_TEMPLATES = [
  "quote",
  "stat",
  "list",
  "hero",
] as const;
export const DEFAULT_CARD_FORMATS = ["ig_square", "ig_story", "og"] as const;

type CardTemplateName = (typeof DEFAULT_CARD_TEMPLATES)[number];
type CardFormat = (typeof DEFAULT_CARD_FORMATS)[number];

interface CardSize {
  width: number;
  height: number;
}

interface CardURL {
  template: string;
  format: string;
  size: CardSize;
  r2Url: string;
}

interface GeneratedArticleForCards extends Record<string, unknown> {
  id: string;
  title: string;
}

interface BrandForCards extends Record<string, unknown> {
  id: string;
  name: string;
}

interface GenerateCardsInput {
  articleId: string;
  brandId: string;
  formats: CardFormat[];
  templates?: CardTemplateName[];
}

interface BrowserRenderingClient {
  screenshot(input: { html: string; size: CardSize }): Promise<ArrayBuffer>;
}

export type GenerateCardsFn = (
  input: GenerateCardsInput,
  deps: {
    fetchArticle(id: string): Promise<GeneratedArticleForCards>;
    fetchBrand(id: string): Promise<BrandForCards>;
    browserRenderingClient: BrowserRenderingClient;
    r2Bucket: R2Bucket;
  },
) => Promise<CardURL[]>;

export interface ArticleCardGenerationInput {
  articleId: string;
  brandId: string;
  articleJobId?: string;
  companyId?: string;
}

interface RunArticleCardGenerationDeps {
  supabase: SupabaseClient;
  generateCards?: GenerateCardsFn;
  browserRenderingClient?: BrowserRenderingClient;
  r2Bucket?: R2Bucket;
  alertOps?: typeof enqueueOpsAlertEmail;
}

interface ArticleCardGenerationSchedulerDeps
  extends Partial<Omit<RunArticleCardGenerationDeps, "supabase">> {
  getSupabase?: () => Promise<SupabaseClient>;
  run?: (input: ArticleCardGenerationInput) => Promise<void>;
}

export interface ArticleCardGenerationScheduler {
  trigger(input: ArticleCardGenerationInput): void;
}

export function triggerArticleCardGeneration(
  input: ArticleCardGenerationInput,
  deps: ArticleCardGenerationSchedulerDeps = {},
): void {
  const run =
    deps.run ??
    (async (generationInput: ArticleCardGenerationInput) => {
      const supabase = deps.getSupabase
        ? await deps.getSupabase()
        : await Promise.reject(new Error("supabase_not_configured"));

      await runArticleCardGeneration(generationInput, {
        supabase,
        generateCards: deps.generateCards,
        browserRenderingClient: deps.browserRenderingClient,
        r2Bucket: deps.r2Bucket,
        alertOps: deps.alertOps,
      });
    });

  void run(input);
}

export function createArticleCardGenerationScheduler(
  deps: ArticleCardGenerationSchedulerDeps,
): ArticleCardGenerationScheduler {
  return {
    trigger(input) {
      triggerArticleCardGeneration(input, deps);
    },
  };
}

export async function runArticleCardGeneration(
  input: ArticleCardGenerationInput,
  deps: RunArticleCardGenerationDeps,
): Promise<void> {
  const alertOps = deps.alertOps ?? enqueueOpsAlertEmail;
  const startedAt = new Date().toISOString();

  try {
    const generateCards =
      deps.generateCards ?? (await loadDefaultGenerateCards());
    const browserRenderingClient =
      deps.browserRenderingClient ?? createHttpBrowserRenderingClient();
    const r2Bucket = deps.r2Bucket ?? createR2BucketAdapter();
    const fetchers = createSupabaseFetchers(deps.supabase);
    const cardUrls: CardURL[] = [];

    for (const template of DEFAULT_CARD_TEMPLATES) {
      const generated = await generateCards(
        {
          articleId: input.articleId,
          brandId: input.brandId,
          formats: [...DEFAULT_CARD_FORMATS],
          templates: [template],
        },
        {
          ...fetchers,
          browserRenderingClient,
          r2Bucket,
        },
      );
      cardUrls.push(...generated);
    }

    if (cardUrls.length === 0) return;

    const { error } = await deps.supabase.from("article_assets").insert(
      cardUrls.map((card) => ({
        article_id: input.articleId,
        kind: "card",
        template: card.template,
        size: card.format || `${card.size.width}x${card.size.height}`,
        r2_url: card.r2Url,
        brand_id: input.brandId,
      })),
    );

    if (error) {
      throw new Error(`article_assets_insert_failed: ${error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ArticleCards] Card generation failed", {
      articleId: input.articleId,
      brandId: input.brandId,
      articleJobId: input.articleJobId,
      error: message,
    });

    try {
      await alertOps({
        subject: "[1WaySEO] Card generation failed",
        text: [
          "Article card generation failed.",
          `article_id: ${input.articleId}`,
          `brand_id: ${input.brandId}`,
          input.articleJobId ? `article_job_id: ${input.articleJobId}` : null,
          input.companyId ? `company_id: ${input.companyId}` : null,
          `started_at: ${startedAt}`,
          `error: ${message}`,
        ]
          .filter(Boolean)
          .join("\n"),
        idempotencyKey: `article-card-generation-failed:${input.articleId}:${startedAt}`,
      });
    } catch (alertError) {
      console.error("[ArticleCards] Ops alert failed", alertError);
    }
  }
}

function createSupabaseFetchers(supabase: SupabaseClient) {
  const articleCache = new Map<string, Promise<GeneratedArticleForCards>>();
  const brandCache = new Map<string, Promise<BrandForCards>>();

  return {
    fetchArticle(id: string) {
      if (!articleCache.has(id)) {
        articleCache.set(
          id,
          fetchRequiredRow(
            supabase,
            "generated_articles",
            id,
          ) as Promise<GeneratedArticleForCards>,
        );
      }
      return articleCache.get(id)!;
    },
    fetchBrand(id: string) {
      if (!brandCache.has(id)) {
        brandCache.set(
          id,
          fetchRequiredRow(supabase, "brands", id) as Promise<BrandForCards>,
        );
      }
      return brandCache.get(id)!;
    },
  };
}

async function fetchRequiredRow(
  supabase: SupabaseClient,
  table: "generated_articles" | "brands",
  id: string,
): Promise<GeneratedArticleForCards | BrandForCards> {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(`${table}_lookup_failed: ${error.message}`);
  }

  if (!data) {
    throw new Error(`${table}_not_found`);
  }

  return data as GeneratedArticleForCards | BrandForCards;
}

async function loadDefaultGenerateCards(): Promise<GenerateCardsFn> {
  const edgeModule = (await import("@seo/edge")) as unknown as {
    generateCards: GenerateCardsFn;
  };
  return edgeModule.generateCards;
}

function createHttpBrowserRenderingClient(): BrowserRenderingClient {
  const apiUrl = process.env.CARD_BROWSER_RENDERING_URL?.trim();
  const apiToken = process.env.CARD_BROWSER_RENDERING_TOKEN?.trim();

  if (!apiUrl) {
    throw new Error("card_browser_rendering_not_configured");
  }

  return {
    async screenshot(input) {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({
          html: input.html,
          width: input.size.width,
          height: input.size.height,
        }),
      });

      if (!response.ok) {
        throw new Error(`card_browser_rendering_failed_${response.status}`);
      }

      return response.arrayBuffer();
    },
  };
}

function createR2BucketAdapter(): R2Bucket {
  const config = getR2Config();

  if (!config) {
    throw new Error("r2_not_configured");
  }

  const client = new R2Client(config);

  return {
    put: async (
      key: string,
      value: ArrayBuffer | ArrayBufferView | string,
      options?: { httpMetadata?: { contentType?: string } },
    ) => {
      await client.putObject(key, value, options?.httpMetadata?.contentType);
      return null;
    },
  } as unknown as R2Bucket;
}
