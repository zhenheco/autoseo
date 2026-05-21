import { beforeEach, describe, expect, it, vi } from "vitest";
import { ParallelOrchestrator, QuotaExceededError } from "../orchestrator";
import type { ArticleGenerationInput } from "@/types/agents";
import type { BrandMemoryStore } from "@/lib/brands/memory-store";
import type { QuotaEnforcer } from "@/lib/quota/enforcer";
import type { ArticleCardGenerationScheduler } from "@/lib/cards/article-card-generation";

const mocks = vi.hoisted(() => ({
  writingExecute: vi.fn(),
  featuredImageExecute: vi.fn(),
  articleImageExecute: vi.fn(),
  metaExecute: vi.fn(),
  linkExecute: vi.fn(),
  categoryGenerate: vi.fn(),
  competitorExecute: vi.fn(),
  contentPlanExecute: vi.fn(),
  saveArticleWithRecommendations: vi.fn(),
  deductArticle: vi.fn(),
  consumeReservation: vi.fn(),
}));

vi.mock("../writing-agent", () => ({
  WritingAgent: vi.fn(function WritingAgent() {
    return { execute: mocks.writingExecute };
  }),
}));

vi.mock("../featured-image-agent", () => ({
  FeaturedImageAgent: vi.fn(function FeaturedImageAgent() {
    return { execute: mocks.featuredImageExecute };
  }),
}));

vi.mock("../article-image-agent", () => ({
  ArticleImageAgent: vi.fn(function ArticleImageAgent() {
    return { execute: mocks.articleImageExecute };
  }),
}));

vi.mock("../meta-agent", () => ({
  MetaAgent: vi.fn(function MetaAgent() {
    return { execute: mocks.metaExecute };
  }),
}));

vi.mock("../link-processor-agent", () => ({
  LinkProcessorAgent: vi.fn(function LinkProcessorAgent() {
    return { execute: mocks.linkExecute };
  }),
}));

vi.mock("../category-agent", () => ({
  CategoryAgent: vi.fn(function CategoryAgent() {
    return { generateCategories: mocks.categoryGenerate };
  }),
}));

vi.mock("../competitor-analysis-agent", () => ({
  CompetitorAnalysisAgent: vi.fn(function CompetitorAnalysisAgent() {
    return {
      execute: mocks.competitorExecute,
    };
  }),
}));

vi.mock("../content-plan-agent", () => ({
  ContentPlanAgent: vi.fn(function ContentPlanAgent() {
    return { execute: mocks.contentPlanExecute };
  }),
}));

vi.mock("@/lib/services/article-storage", () => ({
  ArticleStorageService: vi.fn(function ArticleStorageService() {
    return {
      saveArticleWithRecommendations: mocks.saveArticleWithRecommendations,
    };
  }),
}));

vi.mock("@/lib/billing/article-quota-service", () => ({
  ArticleQuotaService: vi.fn(function ArticleQuotaService() {
    return {
      deductArticle: mocks.deductArticle,
      consumeReservation: mocks.consumeReservation,
    };
  }),
}));

vi.mock("../pipeline-helpers", () => ({
  getBrandVoice: vi.fn(async () => ({
    id: "voice-1",
    website_id: "website-1",
    tone_of_voice: "professional",
    target_audience: "operators",
    keywords: [],
    writing_style: "professionalFormal",
  })),
  getWorkflowSettings: vi.fn(async () => ({
    id: "workflow-1",
    website_id: "website-1",
    serp_analysis_enabled: true,
    competitor_count: 3,
    content_length_min: 1200,
    content_length_max: 2000,
    keyword_density_min: 0,
    keyword_density_max: 10,
    quality_threshold: 80,
    auto_publish: false,
    serp_model: "perplexity",
    content_model: "deepseek-chat",
    meta_model: "deepseek-chat",
  })),
  getAgentConfig: vi.fn(async () => ({
    research_model: "deepseek-chat",
    strategy_model: "deepseek-chat",
    writing_model: "deepseek-chat",
    image_model: "fal-ai/qwen-image",
    research_temperature: 0.7,
    strategy_temperature: 0.7,
    writing_temperature: 0.7,
    research_max_tokens: 1000,
    strategy_max_tokens: 1000,
    writing_max_tokens: 1000,
    image_size: "1024x1024",
    image_count: 1,
    meta_enabled: true,
    meta_model: "deepseek-chat",
    meta_temperature: 0.7,
    meta_max_tokens: 1000,
  })),
  getPreviousArticles: vi.fn(async () => []),
  getWebsiteSettings: vi.fn(async () => ({
    language: "zh-TW",
    region: "Taiwan",
    industry: "SEO",
  })),
  getWordPressConfig: vi.fn(async () => null),
  getAIConfig: vi.fn(() => ({})),
}));

describe("ParallelOrchestrator brand memory and quota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.USE_MULTI_AGENT_ARCHITECTURE = "false";

    mocks.writingExecute.mockResolvedValue(createWritingOutput());
    mocks.featuredImageExecute.mockResolvedValue({
      image: null,
      executionInfo: { model: "image", executionTime: 1, cost: 0 },
    });
    mocks.articleImageExecute.mockResolvedValue({
      images: [],
      executionInfo: { model: "image", executionTime: 1, totalCost: 0 },
    });
    mocks.metaExecute.mockResolvedValue(createMetaOutput());
    mocks.linkExecute.mockResolvedValue({ html: "<p>Article</p>" });
    mocks.categoryGenerate.mockResolvedValue({
      categories: [{ name: "SEO", slug: "seo", confidence: 1 }],
      tags: [{ name: "Content", slug: "content", confidence: 1 }],
      focusKeywords: ["seo"],
    });
    mocks.competitorExecute.mockRejectedValue(new Error("skip competitors"));
    mocks.contentPlanExecute.mockRejectedValue(new Error("skip content plan"));
    mocks.saveArticleWithRecommendations.mockResolvedValue({
      article: { id: "article-1" },
      recommendations: [],
    });
    mocks.deductArticle.mockResolvedValue({
      success: true,
      deductedFrom: "subscription",
      logId: "usage-1",
      subscriptionRemaining: 10,
      purchasedRemaining: 0,
      totalRemaining: 10,
    });
    mocks.consumeReservation.mockResolvedValue(true);
  });

  it("uses brandId and passes brand memory prompt to the writing agent when quota is allowed", async () => {
    const brandMemoryStore = createBrandMemoryStoreMock();
    const quotaEnforcer = createQuotaEnforcerMock();
    const orchestrator = createOrchestrator({
      brandMemoryStore,
      quotaEnforcer,
    });

    await orchestrator.execute(createInput({ brandId: "brand-1" }));

    expect(brandMemoryStore.getPromptInjection).toHaveBeenCalledWith("brand-1");
    expect(mocks.writingExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        brandMemoryPrompt: "BRAND MEMORY PROMPT",
      }),
    );
  });

  it("resolves the default brand when brandId is missing", async () => {
    const brandMemoryStore = createBrandMemoryStoreMock();
    const orchestrator = createOrchestrator({
      brandMemoryStore,
      quotaEnforcer: createQuotaEnforcerMock(),
      resolveDefaultBrandId: vi.fn(async () => "default-brand"),
    });

    await orchestrator.execute(createInput({ brandId: undefined }));

    expect(brandMemoryStore.getPromptInjection).toHaveBeenCalledWith(
      "default-brand",
    );
  });

  it("throws QuotaExceededError and never calls the LLM-facing writer when quota is denied", async () => {
    const quotaEnforcer = createQuotaEnforcerMock({ allowed: false });
    const orchestrator = createOrchestrator({
      brandMemoryStore: createBrandMemoryStoreMock(),
      quotaEnforcer,
    });

    await expect(
      orchestrator.execute(createInput({ brandId: "brand-1" })),
    ).rejects.toBeInstanceOf(QuotaExceededError);
    expect(mocks.writingExecute).not.toHaveBeenCalled();
  });

  it("consumes article quota exactly once after successful generation", async () => {
    const quotaEnforcer = createQuotaEnforcerMock();
    const orchestrator = createOrchestrator({
      brandMemoryStore: createBrandMemoryStoreMock(),
      quotaEnforcer,
    });

    await orchestrator.execute(createInput({ brandId: "brand-1" }));

    expect(quotaEnforcer.consume).toHaveBeenCalledTimes(1);
    expect(quotaEnforcer.consume).toHaveBeenCalledWith(
      "company-1",
      "articles",
      1,
    );
  });

  it("triggers async card generation after a successful article save", async () => {
    const cardGenerationScheduler = createCardGenerationSchedulerMock();
    const orchestrator = createOrchestrator({
      brandMemoryStore: createBrandMemoryStoreMock(),
      quotaEnforcer: createQuotaEnforcerMock(),
      cardGenerationScheduler,
    });

    await orchestrator.execute(createInput({ brandId: "brand-1" }));

    expect(cardGenerationScheduler.trigger).toHaveBeenCalledWith({
      articleId: "article-1",
      brandId: "brand-1",
      articleJobId: "job-1",
      companyId: "company-1",
    });
  });

  it("keeps the article successful when card generation trigger fails", async () => {
    const cardGenerationScheduler = createCardGenerationSchedulerMock();
    vi.mocked(cardGenerationScheduler.trigger).mockImplementationOnce(() => {
      throw new Error("card trigger failed");
    });
    const orchestrator = createOrchestrator({
      brandMemoryStore: createBrandMemoryStoreMock(),
      quotaEnforcer: createQuotaEnforcerMock(),
      cardGenerationScheduler,
    });

    const result = await orchestrator.execute(
      createInput({ brandId: "brand-1" }),
    );

    expect(result.success).toBe(true);
    expect(result.savedArticle?.id).toBe("article-1");
  });

  it("does not consume article quota when generation fails", async () => {
    mocks.writingExecute.mockRejectedValueOnce(new Error("generation failed"));
    const quotaEnforcer = createQuotaEnforcerMock();
    const orchestrator = createOrchestrator({
      brandMemoryStore: createBrandMemoryStoreMock(),
      quotaEnforcer,
    });

    await expect(
      orchestrator.execute(createInput({ brandId: "brand-1" })),
    ).rejects.toThrow("generation failed");
    expect(quotaEnforcer.consume).not.toHaveBeenCalled();
  });
});

function createOrchestrator(input: {
  brandMemoryStore: BrandMemoryStore;
  quotaEnforcer: QuotaEnforcer;
  cardGenerationScheduler?: ArticleCardGenerationScheduler;
  resolveDefaultBrandId?: (
    companyId: string,
    supabase: unknown,
  ) => Promise<string | null>;
}) {
  return new ParallelOrchestrator(createSupabaseMock() as never, {
    ...input,
    cardGenerationScheduler:
      input.cardGenerationScheduler ?? createCardGenerationSchedulerMock(),
  });
}

function createBrandMemoryStoreMock(): BrandMemoryStore {
  return {
    getMemory: vi.fn(),
    updateMemory: vi.fn(),
    getPromptInjection: vi.fn(async () => "BRAND MEMORY PROMPT"),
  };
}

function createQuotaEnforcerMock(input?: { allowed?: boolean }): QuotaEnforcer {
  return {
    canConsume: vi.fn(async () => ({
      allowed: input?.allowed ?? true,
      used: input?.allowed === false ? 30 : 1,
      cap: 30,
      remaining: input?.allowed === false ? 0 : 29,
      plan: "solo" as const,
      resource: "articles",
    })),
    consume: vi.fn(async () => ({
      allowed: true,
      used: 2,
      cap: 30,
      remaining: 28,
      plan: "solo" as const,
      resource: "articles",
    })),
    getUsage: vi.fn(),
  };
}

function createCardGenerationSchedulerMock(): ArticleCardGenerationScheduler {
  return {
    trigger: vi.fn(),
  };
}

function createInput(input: { brandId?: string }): ArticleGenerationInput {
  return {
    articleJobId: "job-1",
    companyId: "company-1",
    websiteId: "website-1",
    userId: "user-1",
    title: "SEO automation",
    brandId: input.brandId,
  };
}

function createSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "user-1" } },
      })),
    },
    rpc: vi.fn(async () => ({ data: [], error: null })),
    from(table: string) {
      let selected = "";
      const builder = {
        select(columns: string) {
          selected = columns;
          return builder;
        },
        eq() {
          return builder;
        },
        limit() {
          return builder;
        },
        insert() {
          return Promise.resolve({ data: null, error: null });
        },
        update() {
          return builder;
        },
        upsert() {
          return builder;
        },
        single() {
          return Promise.resolve(resolveSingle(table, selected));
        },
        maybeSingle() {
          return Promise.resolve(resolveSingle(table, selected));
        },
        then(
          onfulfilled?: (value: { data: unknown[]; error: null }) => unknown,
        ) {
          return Promise.resolve({ data: [], error: null }).then(onfulfilled);
        },
      };
      return builder;
    },
  };
}

function resolveSingle(table: string, selected: string) {
  if (table === "article_jobs" && selected.includes("metadata")) {
    return {
      data: {
        status: "processing",
        metadata: {
          current_phase: "strategy_completed",
          research: createResearchOutput(),
          strategy: createStrategyOutput(),
        },
      },
      error: null,
    };
  }

  if (table === "article_jobs" && selected === "status") {
    return { data: { status: "processing" }, error: null };
  }

  if (table === "article_jobs") {
    return { data: { id: "job-1", company_id: "company-1" }, error: null };
  }

  return { data: null, error: null };
}

function createResearchOutput() {
  return {
    title: "SEO automation",
    searchIntent: "informational",
    intentConfidence: 0.9,
    topRankingFeatures: {
      contentLength: { min: 800, max: 1200, avg: 1000 },
      titlePatterns: [],
      structurePatterns: [],
      commonTopics: [],
      commonFormats: [],
    },
    contentGaps: [],
    competitorAnalysis: [],
    recommendedStrategy: "Practical guide",
    relatedKeywords: ["seo"],
    executionInfo: {
      model: "deepseek-chat",
      executionTime: 1,
      tokenUsage: { input: 1, output: 1 },
    },
  };
}

function createStrategyOutput() {
  return {
    titleOptions: ["SEO automation guide"],
    selectedTitle: "SEO automation guide",
    outline: {
      introduction: {
        hook: "Hook",
        context: "Context",
        thesis: "Thesis",
        wordCount: 100,
      },
      mainSections: [],
      conclusion: {
        summary: "Summary",
        callToAction: "CTA",
        wordCount: 100,
      },
      faq: [],
    },
    targetWordCount: 1200,
    sectionWordDistribution: {
      introduction: 100,
      mainSections: 1000,
      conclusion: 100,
      faq: 0,
    },
    keywordDensityTarget: 0,
    keywords: ["seo"],
    relatedKeywords: ["seo"],
    lsiKeywords: ["automation"],
    internalLinkingStrategy: {
      targetSections: [],
      suggestedTopics: [],
      minLinks: 0,
    },
    differentiationStrategy: {
      uniqueAngles: [],
      valueProposition: "Practical",
      competitiveAdvantages: [],
    },
    externalReferences: [],
    executionInfo: {
      model: "deepseek-chat",
      executionTime: 1,
      tokenUsage: { input: 1, output: 1 },
    },
  };
}

function createWritingOutput() {
  return {
    markdown: "## Article",
    html: "<p>Article</p>",
    statistics: {
      wordCount: 100,
      paragraphCount: 1,
      sentenceCount: 3,
      readingTime: 1,
      averageSentenceLength: 10,
    },
    internalLinks: [],
    keywordUsage: {
      count: 1,
      density: 1,
      distribution: [],
    },
    readability: {
      fleschKincaidGrade: 8,
      fleschReadingEase: 70,
      gunningFogIndex: 9,
    },
    executionInfo: {
      model: "deepseek-chat",
      executionTime: 1,
      tokenUsage: { input: 1, output: 1 },
    },
  };
}

function createMetaOutput() {
  return {
    seo: {
      title: "SEO automation guide",
      description: "Description",
      keywords: ["seo"],
    },
    slug: "seo-automation-guide",
    focusKeyphrase: "seo",
    openGraph: {
      title: "SEO automation guide",
      description: "Description",
      image: "",
      type: "article",
    },
    twitterCard: {
      card: "summary_large_image",
      title: "SEO automation guide",
      description: "Description",
      image: "",
    },
    executionInfo: {
      model: "deepseek-chat",
      executionTime: 1,
      tokenUsage: { input: 1, output: 1 },
    },
  };
}
