import { createAdminClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { ArticleStorageService } from "@/lib/services/article-storage";
import { ResearchAgent } from "./research-agent";
import { UnifiedStrategyAgent } from "./unified-strategy-agent";
import { UnifiedWritingAgent } from "./unified-writing-agent";
import { WritingAgent } from "./writing-agent";
import { FeaturedImageAgent } from "./featured-image-agent";
import { ArticleImageAgent } from "./article-image-agent";
import { MetaAgent } from "./meta-agent";
import { LinkProcessorAgent } from "./link-processor-agent";
import { CompetitorAnalysisAgent } from "./competitor-analysis-agent";
import { CategoryAgent } from "./category-agent";
import { WordPressClient } from "@/lib/wordpress/client";
import { ErrorTracker } from "./error-tracker";
import { PipelineLogger } from "./pipeline-logger";
import { RetryConfigs, type AgentRetryConfig } from "./retry-config";
import {
  PipelineContext,
  PipelinePhase,
  type PipelineContextOptions,
} from "./pipeline-context";
import { CheckpointManager, CHECKPOINT_VERSION } from "./checkpoint-manager";
import { checkIdempotency, getExistingArticle } from "./idempotency-checker";
import type {
  ArticleGenerationInput,
  ArticleGenerationResult,
  BrandVoice,
  WorkflowSettings,
  AgentConfig,
  PreviousArticle,
  AIClientConfig,
  GeneratedImage,
  ImageOutput,
  WritingOutput,
} from "@/types/agents";
import type { AIModel } from "@/types/ai-models";
import { AgentExecutionContext } from "./base-agent";

export class LinearOrchestrator {
  private supabaseClient?: SupabaseClient;
  private errorTracker: ErrorTracker;
  private pipelineLogger?: PipelineLogger;
  private checkpointManager?: CheckpointManager;
  private pipelineContext?: PipelineContext;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.errorTracker = new ErrorTracker({
      enableLogging: true,
      enableMetrics: true,
      enableExternalTracking: process.env.ERROR_TRACKING_ENABLED === "true",
      maxErrorsInMemory: 100,
      enableDatabaseTracking: true,
      getSupabase: () => this.getSupabase(),
    });
  }

  private async getSupabase(): Promise<SupabaseClient> {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }
    return createAdminClient();
  }

  private initializeManagers(
    jobId: string,
    keyword: string,
    companyId: string,
  ): void {
    this.checkpointManager = new CheckpointManager(jobId);

    this.errorTracker = new ErrorTracker({
      enableLogging: true,
      enableMetrics: true,
      enableExternalTracking: process.env.ERROR_TRACKING_ENABLED === "true",
      maxErrorsInMemory: 100,
      enableDatabaseTracking: true,
      getSupabase: () => this.getSupabase(),
      jobId,
    });

    this.pipelineLogger = new PipelineLogger({
      jobId,
      keyword,
      companyId,
      enableDatabaseSync: true,
      getSupabase: () => this.getSupabase(),
    });
  }

  async execute(
    input: ArticleGenerationInput,
  ): Promise<ArticleGenerationResult> {
    const supabase = await this.getSupabase();
    const startTime = Date.now();

    this.initializeManagers(input.articleJobId, input.title, input.companyId);

    const phaseTimings = {
      research: 0,
      strategy: 0,
      contentGeneration: 0,
      metaGeneration: 0,
    };

    const result: ArticleGenerationResult = {
      success: false,
      articleJobId: input.articleJobId,
      executionStats: {
        totalTime: 0,
        phases: phaseTimings,
        parallelSpeedup: 0,
      },
    };

    try {
      const idempotencyResult = await checkIdempotency(
        input.websiteId,
        input.title,
      );

      if (idempotencyResult.isDuplicate) {
        console.log("[LinearOrchestrator] Idempotency check: duplicate found");

        if (idempotencyResult.existingArticleId) {
          const existingArticle = await getExistingArticle(
            input.websiteId,
            input.title,
          );
          if (existingArticle) {
            return this.reconstructResultFromArticle(existingArticle);
          }
        }

        if (idempotencyResult.existingJobId) {
          console.log(
            "[LinearOrchestrator] Job already in progress:",
            idempotencyResult.existingJobId,
          );
          result.errors = {
            idempotency: new Error(idempotencyResult.message),
          };
          return result;
        }
      }

      const { context, resumePhase } = await this.initializeOrResume(input);
      this.pipelineContext = context;

      const aiConfig = this.getAIConfig();
      const executionContext: AgentExecutionContext = {
        websiteId: input.websiteId,
        companyId: input.companyId,
        articleJobId: input.articleJobId,
      };

      let currentPhase = resumePhase || PipelinePhase.RESEARCH;

      if (
        currentPhase === PipelinePhase.RESEARCH ||
        !context.isPhaseCompleted(PipelinePhase.RESEARCH)
      ) {
        await this.executeResearchPhase(
          context,
          aiConfig,
          executionContext,
          phaseTimings,
        );
        result.research = context.getResearch();
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.COMPETITOR_ANALYSIS;
      } else {
        result.research = context.getResearch();
      }

      if (
        currentPhase === PipelinePhase.COMPETITOR_ANALYSIS ||
        !context.isPhaseCompleted(PipelinePhase.COMPETITOR_ANALYSIS)
      ) {
        await this.executeCompetitorAnalysisPhase(
          context,
          aiConfig,
          executionContext,
        );
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.STRATEGY;
      }

      if (
        currentPhase === PipelinePhase.STRATEGY ||
        !context.isPhaseCompleted(PipelinePhase.STRATEGY) ||
        !context.isPhaseCompleted(PipelinePhase.CONTENT_PLAN)
      ) {
        await this.executeUnifiedStrategyPhase(
          context,
          aiConfig,
          executionContext,
          phaseTimings,
        );
        result.strategy = context.getStrategy();
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.IMAGE;
      } else {
        result.strategy = context.getStrategy();
      }

      if (
        currentPhase === PipelinePhase.IMAGE ||
        !context.isPhaseCompleted(PipelinePhase.IMAGE)
      ) {
        await this.executeImagePhase(context, aiConfig, executionContext);
        result.image = context.getImages();
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.WRITING;
      } else {
        result.image = context.getImages();
      }

      if (
        currentPhase === PipelinePhase.WRITING ||
        !context.isPhaseCompleted(PipelinePhase.WRITING)
      ) {
        await this.executeWritingPhase(
          context,
          aiConfig,
          executionContext,
          phaseTimings,
        );
        result.writing = context.getWriting();
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.LINK_ENRICHMENT;
      } else {
        result.writing = context.getWriting();
      }

      if (
        currentPhase === PipelinePhase.LINK_ENRICHMENT ||
        !context.isPhaseCompleted(PipelinePhase.LINK_ENRICHMENT)
      ) {
        await this.executeLinkEnrichmentPhase(
          context,
          aiConfig,
          executionContext,
          input.websiteId,
        );
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.META;
      }

      if (
        currentPhase === PipelinePhase.META ||
        !context.isPhaseCompleted(PipelinePhase.META)
      ) {
        await this.executeMetaPhase(
          context,
          aiConfig,
          executionContext,
          phaseTimings,
        );
        result.meta = context.getMeta();
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.CATEGORY;
      } else {
        result.meta = context.getMeta();
      }

      if (
        currentPhase === PipelinePhase.CATEGORY ||
        !context.isPhaseCompleted(PipelinePhase.CATEGORY)
      ) {
        await this.executeCategoryPhase(context, input.websiteId);
        result.category = context.getCategory();
        await this.saveCheckpoint(context);
        currentPhase = PipelinePhase.PUBLISH;
      } else {
        result.category = context.getCategory();
      }

      if (
        currentPhase === PipelinePhase.PUBLISH ||
        !context.isPhaseCompleted(PipelinePhase.PUBLISH)
      ) {
        await this.executePublishPhase(context, input, result);
      }

      context.markCompleted();
      await this.saveCheckpoint(context);

      const totalTime = Date.now() - startTime;
      const serialTime =
        phaseTimings.research +
        phaseTimings.strategy +
        phaseTimings.contentGeneration +
        phaseTimings.metaGeneration;

      result.success = !!(result.writing && result.meta);
      result.executionStats = {
        totalTime,
        phases: phaseTimings,
        parallelSpeedup: serialTime > 0 ? serialTime / totalTime : 1,
      };

      await this.saveArticleToDatabase(context, input, result, supabase);

      this.pipelineLogger?.complete();
      return result;
    } catch (error) {
      const err = error as Error;
      this.pipelineContext?.markFailed({
        phase: this.pipelineContext.getCurrentPhase(),
        message: err.message,
        stack: err.stack,
      });

      if (this.pipelineContext) {
        await this.saveCheckpoint(this.pipelineContext);
      }

      this.pipelineLogger?.fail(err.message);
      result.errors = { orchestrator: err };
      await this.updateJobStatus(input.articleJobId, "failed", result);
      throw error;
    }
  }

  private async initializeOrResume(
    input: ArticleGenerationInput,
  ): Promise<{ context: PipelineContext; resumePhase: PipelinePhase | null }> {
    if (this.checkpointManager) {
      const { context: savedContext, resumePhase } =
        await this.checkpointManager.resumeFromCheckpoint();

      if (savedContext && resumePhase) {
        console.log(
          `[LinearOrchestrator] Resuming from checkpoint at phase: ${resumePhase}`,
        );
        return { context: savedContext, resumePhase };
      }
    }

    const [brandVoice, workflowSettings, agentConfig, websiteSettings] =
      await Promise.all([
        this.getBrandVoice(input.websiteId, input.companyId),
        this.getWorkflowSettings(input.websiteId),
        this.getAgentConfig(input.websiteId),
        this.getWebsiteSettings(input.websiteId),
      ]);

    const contextOptions: PipelineContextOptions = {
      articleJobId: input.articleJobId,
      companyId: input.companyId,
      websiteId: input.websiteId,
      userId: input.userId,
      keyword: input.title,
      targetLanguage:
        input.targetLanguage || input.language || websiteSettings.language,
      targetWordCount: input.wordCount || workflowSettings.content_length_min,
      imageCount: input.imageCount || 3,
      industry: input.industry || websiteSettings.industry || undefined,
      region: input.region || websiteSettings.region,
    };

    const context = new PipelineContext(contextOptions);
    context.setBrandVoice(brandVoice);
    context.setWorkflowSettings(workflowSettings);
    context.setAgentConfig(agentConfig);
    context.setWebsiteSettings({
      id: input.websiteId,
      name: "",
      url: "",
      targetLanguage: contextOptions.targetLanguage || "zh-TW",
      defaultIndustry: contextOptions.industry,
      defaultRegion: contextOptions.region,
    });

    return { context, resumePhase: null };
  }

  private async executeResearchPhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
    phaseTimings: { research: number },
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.RESEARCH);
    this.pipelineLogger?.startPhase("research", {
      keyword: context.getKeyword(),
    });

    const startTime = Date.now();
    const agentConfig = context.getAgentConfig();

    const researchAgent = new ResearchAgent(aiConfig, executionContext);
    const researchOutput = await researchAgent.execute({
      title: context.getKeyword(),
      region: context.getRegion(),
      competitorCount: context.getWorkflowSettings().competitor_count,
      model: agentConfig.research_model,
      temperature: agentConfig.research_temperature,
      maxTokens: agentConfig.research_max_tokens,
    });

    phaseTimings.research = Date.now() - startTime;
    context.setResearch(researchOutput);

    this.pipelineLogger?.completePhase("research", {
      competitorCount: researchOutput.competitorAnalysis?.length || 0,
      externalRefsCount: researchOutput.externalReferences?.length || 0,
    });
  }

  private async executeCompetitorAnalysisPhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.COMPETITOR_ANALYSIS);

    const research = context.getResearch();
    if (!research) {
      context.addWarning({
        phase: PipelinePhase.COMPETITOR_ANALYSIS,
        message: "No research data available, skipping competitor analysis",
      });
      context.completePhase(PipelinePhase.COMPETITOR_ANALYSIS);
      return;
    }

    try {
      const agentConfig = context.getAgentConfig();
      const competitorAgent = new CompetitorAnalysisAgent(
        aiConfig,
        executionContext,
      );

      const competitorAnalysis = await competitorAgent.execute({
        serpData: research,
        primaryKeyword: context.getKeyword(),
        targetLanguage: context.getTargetLanguage(),
        model: agentConfig.strategy_model,
        temperature: 0.3,
        maxTokens: 2000,
      });

      context.setCompetitorAnalysis(competitorAnalysis);
    } catch (error) {
      context.addWarning({
        phase: PipelinePhase.COMPETITOR_ANALYSIS,
        message: `Competitor analysis failed: ${(error as Error).message}`,
      });
      context.completePhase(PipelinePhase.COMPETITOR_ANALYSIS);
    }
  }

  private async executeUnifiedStrategyPhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
    phaseTimings: { strategy: number },
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.STRATEGY);
    this.pipelineLogger?.startPhase("strategy");

    const startTime = Date.now();
    const research = context.getResearch();
    if (!research) {
      throw new Error("Research output is required for strategy phase");
    }

    const agentConfig = context.getAgentConfig();
    const unifiedStrategyAgent = new UnifiedStrategyAgent(
      aiConfig,
      executionContext,
    );

    const { strategy, contentPlan } = await unifiedStrategyAgent.execute({
      research,
      competitorAnalysis: context.getCompetitorAnalysis(),
      brandVoice: context.getBrandVoice(),
      targetWordCount: context.getTargetWordCount(),
      targetLanguage: context.getTargetLanguage(),
      model: agentConfig.strategy_model,
      temperature: agentConfig.strategy_temperature,
      maxTokens: agentConfig.strategy_max_tokens,
    });

    phaseTimings.strategy = Date.now() - startTime;
    context.setStrategy(strategy);
    context.setContentPlan(contentPlan);

    this.pipelineLogger?.completePhase("strategy", {
      selectedTitle: strategy.selectedTitle,
      sectionsCount: strategy.outline?.mainSections?.length || 0,
      contentPlanSections:
        contentPlan.detailedOutline?.mainSections?.length || 0,
    });
  }

  private async executeImagePhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.IMAGE);

    const strategy = context.getStrategy();
    if (!strategy) {
      throw new Error("Strategy output is required for image phase");
    }

    const agentConfig = context.getAgentConfig();
    const featuredImageModel =
      agentConfig.featured_image_model || "gemini-2.5-flash-image";
    const contentImageModel =
      agentConfig.content_image_model || "gpt-image-1-mini";

    const featuredImageAgent = new FeaturedImageAgent(
      aiConfig,
      executionContext,
    );
    const articleImageAgent = new ArticleImageAgent(aiConfig, executionContext);

    const [featuredResult, contentResult] = await Promise.all([
      featuredImageAgent.execute({
        title: strategy.selectedTitle,
        model: featuredImageModel,
        quality: "medium",
        size: agentConfig.image_size,
      }),
      articleImageAgent.execute({
        title: strategy.selectedTitle,
        outline: strategy.outline,
        model: contentImageModel,
        quality: "medium",
        size: agentConfig.image_size,
      }),
    ]);

    const imageOutput: ImageOutput = {
      featuredImage: featuredResult.image,
      contentImages: contentResult.images,
      executionInfo: {
        model: `featured:${featuredImageModel}, content:${contentImageModel}`,
        totalImages: 1 + contentResult.images.length,
        executionTime:
          featuredResult.executionInfo.executionTime +
          contentResult.executionInfo.executionTime,
        totalCost:
          featuredResult.executionInfo.cost +
          contentResult.executionInfo.totalCost,
      },
    };

    context.setImages(imageOutput);
  }

  private async executeWritingPhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
    phaseTimings: { contentGeneration: number },
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.WRITING);
    this.pipelineLogger?.startPhase("writing");

    const startTime = Date.now();
    const strategy = context.getStrategy();
    const contentPlan = context.getContentPlan();
    const imageOutput = context.getImages();

    if (!strategy) {
      throw new Error("Strategy output is required for writing phase");
    }

    const agentConfig = context.getAgentConfig();
    const useUnifiedWriting = process.env.USE_UNIFIED_WRITING !== "false";

    let writingOutput: WritingOutput;

    if (useUnifiedWriting) {
      console.log("[LinearOrchestrator] 使用 UnifiedWritingAgent（順序寫作）");
      const unifiedWritingAgent = new UnifiedWritingAgent(
        aiConfig,
        executionContext,
      );
      writingOutput = await unifiedWritingAgent.execute({
        strategy,
        contentPlan,
        brandVoice: context.getBrandVoice(),
        imageOutput,
        targetLanguage: context.getTargetLanguage(),
        primaryKeyword: context.getKeyword(),
        industry: context.getIndustry(),
        region: context.getRegion(),
        model: agentConfig.writing_model,
        temperature: agentConfig.writing_temperature,
        maxTokens: agentConfig.writing_max_tokens,
      });
    } else {
      console.log("[LinearOrchestrator] 使用 Legacy WritingAgent");
      writingOutput = await this.executeLegacyWriting(
        context,
        aiConfig,
        executionContext,
        strategy,
      );
    }

    phaseTimings.contentGeneration = Date.now() - startTime;
    context.setWriting(writingOutput);

    this.pipelineLogger?.completePhase("writing", {
      wordCount: writingOutput.statistics.wordCount,
    });
  }

  private async executeLegacyWriting(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
    strategy: NonNullable<ReturnType<typeof context.getStrategy>>,
  ): Promise<WritingOutput> {
    const agentConfig = context.getAgentConfig();
    const previousArticles = await this.getPreviousArticles(
      context.getWebsiteSettings().id,
      context.getKeyword(),
    );

    const writingAgent = new WritingAgent(aiConfig, executionContext);
    return writingAgent.execute({
      strategy,
      brandVoice: context.getBrandVoice(),
      previousArticles,
      competitorAnalysis: context.getCompetitorAnalysis(),
      model: agentConfig.writing_model,
      temperature: agentConfig.writing_temperature,
      maxTokens: agentConfig.writing_max_tokens,
    });
  }

  private async executeLinkEnrichmentPhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
    websiteId: string,
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.LINK_ENRICHMENT);

    const writing = context.getWriting();
    const strategy = context.getStrategy();
    if (!writing || !strategy) {
      context.addWarning({
        phase: PipelinePhase.LINK_ENRICHMENT,
        message: "Missing writing or strategy, skipping link enrichment",
      });
      context.completePhase(PipelinePhase.LINK_ENRICHMENT);
      return;
    }

    try {
      const previousArticles = await this.getPreviousArticles(
        websiteId,
        context.getKeyword(),
      );

      const linkProcessor = new LinkProcessorAgent();
      const linkOutput = await linkProcessor.execute({
        html: writing.html,
        internalLinks: previousArticles.map((a) => ({
          url: a.url,
          title: a.title,
          keywords: a.keywords,
        })),
        externalReferences: strategy.externalReferences || [],
        targetLanguage: context.getTargetLanguage(),
      });

      const enrichedWriting: WritingOutput = {
        ...writing,
        html: linkOutput.html,
      };
      context.setWriting(enrichedWriting);

      const imageOutput = context.getImages();
      if (imageOutput) {
        const htmlWithImages = this.insertImagesToHtml(
          linkOutput.html,
          imageOutput.featuredImage,
          imageOutput.contentImages,
        );
        context.setHtml(htmlWithImages);
      } else {
        context.setHtml(linkOutput.html);
      }
    } catch (error) {
      context.addWarning({
        phase: PipelinePhase.LINK_ENRICHMENT,
        message: `Link enrichment failed: ${(error as Error).message}`,
      });
      context.setHtml(writing.html);
      context.completePhase(PipelinePhase.LINK_ENRICHMENT);
    }
  }

  private async executeMetaPhase(
    context: PipelineContext,
    aiConfig: AIClientConfig,
    executionContext: AgentExecutionContext,
    phaseTimings: { metaGeneration: number },
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.META);
    this.pipelineLogger?.startPhase("meta");

    const startTime = Date.now();
    const writing = context.getWriting();
    const strategy = context.getStrategy();
    const imageOutput = context.getImages();

    if (!writing || !strategy) {
      throw new Error("Writing and strategy output required for meta phase");
    }

    const agentConfig = context.getAgentConfig();
    let metaModel =
      agentConfig.meta_model ||
      agentConfig.simple_processing_model ||
      "deepseek-chat";

    if (metaModel === "gpt-3.5-turbo") {
      metaModel = "deepseek-chat";
    }

    const metaAgent = new MetaAgent(aiConfig, executionContext);
    const metaOutput = await metaAgent.execute({
      content: writing,
      keyword: context.getKeyword(),
      titleOptions: strategy.titleOptions,
      model: metaModel,
      temperature: agentConfig.meta_temperature,
      maxTokens: agentConfig.meta_max_tokens,
    });

    if (imageOutput?.featuredImage) {
      metaOutput.openGraph.image = imageOutput.featuredImage.url;
      metaOutput.twitterCard.image = imageOutput.featuredImage.url;
    }

    phaseTimings.metaGeneration = Date.now() - startTime;
    context.setMeta(metaOutput);

    this.pipelineLogger?.completePhase("meta");
  }

  private async executeCategoryPhase(
    context: PipelineContext,
    websiteId: string,
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.CATEGORY);

    const writing = context.getWriting();
    const strategy = context.getStrategy();
    const meta = context.getMeta();

    if (!writing || !strategy || !meta) {
      context.addWarning({
        phase: PipelinePhase.CATEGORY,
        message: "Missing required data for category phase",
      });
      context.completePhase(PipelinePhase.CATEGORY);
      return;
    }

    const wordpressConfig = await this.getWordPressConfig(websiteId);

    let existingCategories: Array<{
      name: string;
      slug: string;
      count: number;
    }> = [];
    let existingTags: Array<{ name: string; slug: string; count: number }> = [];

    if (wordpressConfig?.enabled) {
      try {
        const wordpressClient = new WordPressClient(wordpressConfig);
        const [categories, tags] = await Promise.all([
          wordpressClient.getCategories(),
          wordpressClient.getTags(),
        ]);

        existingCategories = categories.map((cat) => ({
          name: cat.name,
          slug: cat.slug,
          count: cat.count,
        }));

        existingTags = tags.map((tag) => ({
          name: tag.name,
          slug: tag.slug,
          count: tag.count,
        }));
      } catch (error) {
        context.addWarning({
          phase: PipelinePhase.CATEGORY,
          message: `Failed to fetch WordPress categories: ${(error as Error).message}`,
        });
      }
    }

    const agentConfig = context.getAgentConfig();
    let categoryModel = agentConfig.meta_model || "deepseek-chat";
    if (categoryModel.startsWith("deepseek/")) {
      categoryModel = categoryModel.replace("deepseek/", "");
    }
    if (!categoryModel.startsWith("deepseek-")) {
      categoryModel = "deepseek-chat";
    }
    categoryModel = categoryModel.replace(/:.*$/, "").replace(/-v[\d.]+/, "");

    const categoryAgent = new CategoryAgent(categoryModel);
    const categoryOutput = await categoryAgent.generateCategories({
      title: meta.seo.title,
      content: writing.html || writing.markdown || "",
      keywords: [context.getKeyword(), ...strategy.keywords.slice(0, 5)],
      outline: {
        mainSections: strategy.outline?.mainSections?.map((s) => ({
          heading: s.heading,
        })),
      },
      language: context.getTargetLanguage().startsWith("zh") ? "zh-TW" : "en",
      existingCategories,
      existingTags,
    });

    context.setCategory(categoryOutput);
  }

  private async executePublishPhase(
    context: PipelineContext,
    input: ArticleGenerationInput,
    result: ArticleGenerationResult,
  ): Promise<void> {
    context.setCurrentPhase(PipelinePhase.PUBLISH);

    const wordpressConfig = await this.getWordPressConfig(input.websiteId);
    if (!wordpressConfig?.enabled) {
      context.completePhase(PipelinePhase.PUBLISH);
      return;
    }

    const writing = context.getWriting();
    const meta = context.getMeta();
    const category = context.getCategory();
    const imageOutput = context.getImages();
    const workflowSettings = context.getWorkflowSettings();

    if (!writing || !meta || !category) {
      context.addWarning({
        phase: PipelinePhase.PUBLISH,
        message: "Missing required data for publish phase",
      });
      context.completePhase(PipelinePhase.PUBLISH);
      return;
    }

    try {
      const wordpressClient = new WordPressClient(wordpressConfig);
      const publishResult = await wordpressClient.publishArticle(
        {
          title: meta.seo.title,
          content: context.getHtml() || writing.html || writing.markdown || "",
          excerpt: meta.seo.description,
          slug: meta.slug,
          featuredImageUrl: imageOutput?.featuredImage?.url,
          categories: category.categories.map((c) => c.name),
          tags: category.tags.map((t) => t.name),
          seoTitle: meta.seo.title,
          seoDescription: meta.seo.description,
          focusKeyword: category.focusKeywords[0] || context.getKeyword(),
        },
        workflowSettings.auto_publish ? "publish" : "draft",
      );

      result.wordpress = {
        postId: publishResult.post.id,
        postUrl: publishResult.post.link,
        status: publishResult.post.status,
      };

      context.completePhase(PipelinePhase.PUBLISH);
    } catch (error) {
      context.addWarning({
        phase: PipelinePhase.PUBLISH,
        message: `WordPress publish failed: ${(error as Error).message}`,
      });
      context.completePhase(PipelinePhase.PUBLISH);
    }
  }

  private async saveCheckpoint(context: PipelineContext): Promise<void> {
    if (this.checkpointManager) {
      await this.checkpointManager.saveCheckpoint(context);
    }
  }

  private async saveArticleToDatabase(
    context: PipelineContext,
    input: ArticleGenerationInput,
    result: ArticleGenerationResult,
    supabase: SupabaseClient,
  ): Promise<void> {
    if (!result.success && !result.wordpress) {
      return;
    }

    try {
      const articleStorage = new ArticleStorageService(supabase);

      let userId = input.userId;
      if (!userId) {
        const { data: userData } = await supabase.auth.getUser();
        userId = userData.user?.id;
      }

      if (!userId && input.articleJobId) {
        const { data: jobData } = await supabase
          .from("article_jobs")
          .select("company_id")
          .eq("id", input.articleJobId)
          .single();

        if (jobData) {
          const { data: memberData } = await supabase
            .from("company_members")
            .select("user_id")
            .eq("company_id", jobData.company_id)
            .limit(1)
            .single();

          userId = memberData?.user_id;
        }
      }

      if (!userId) {
        throw new Error("Cannot get valid user_id for article storage");
      }

      const savedArticle = await articleStorage.saveArticleWithRecommendations({
        articleJobId: input.articleJobId,
        result,
        websiteId: input.websiteId,
        companyId: input.companyId,
        userId,
      });

      result.savedArticle = {
        id: savedArticle.article.id,
        recommendationsCount: savedArticle.recommendations.length,
      };

      const totalTokenUsage = this.calculateTotalTokenUsage(result);
      if (totalTokenUsage.charged > 0) {
        try {
          const { TokenBillingService } = await import(
            "@/lib/billing/token-billing-service"
          );
          const tokenBillingService = new TokenBillingService(supabase);

          await tokenBillingService.deductTokensIdempotent({
            idempotencyKey: input.articleJobId,
            companyId: input.companyId,
            articleId: savedArticle.article.id,
            amount: totalTokenUsage.charged,
            metadata: {
              modelName: "linear-orchestrator",
              articleTitle: result.meta?.seo.title,
              totalOfficialTokens: totalTokenUsage.official,
              totalChargedTokens: totalTokenUsage.charged,
            },
          });

          await tokenBillingService.consumeReservation(input.articleJobId);
        } catch (tokenError) {
          console.error(
            "[LinearOrchestrator] Token deduction failed:",
            tokenError,
          );
        }
      }

      await supabase
        .from("article_jobs")
        .update({
          status: "completed",
          metadata: {
            saved_article_id: savedArticle.article.id,
            generation_completed_at: new Date().toISOString(),
          },
        })
        .eq("id", input.articleJobId);
    } catch (storageError) {
      console.error(
        "[LinearOrchestrator] Article storage failed:",
        storageError,
      );
    }
  }

  private async updateJobStatus(
    articleJobId: string,
    status: string,
    data: Partial<ArticleGenerationResult> | Record<string, unknown>,
  ): Promise<void> {
    const supabase = await this.getSupabase();

    const { data: existingJob } = await supabase
      .from("article_jobs")
      .select("metadata")
      .eq("id", articleJobId)
      .single();

    const existingMetadata =
      (existingJob?.metadata as Record<string, unknown>) || {};

    const updateData: Record<string, unknown> = {
      status,
      metadata: {
        ...existingMetadata,
        ...data,
      },
    };

    if (status === "completed" || status === "failed") {
      updateData.completed_at = new Date().toISOString();
    }

    await supabase
      .from("article_jobs")
      .update(updateData)
      .eq("id", articleJobId);
  }

  private insertImagesToHtml(
    html: string,
    featuredImage: GeneratedImage | null,
    contentImages: GeneratedImage[],
  ): string {
    let modifiedHtml = html;

    if (featuredImage) {
      const featuredImageHtml = `<figure class="wp-block-image size-large">
  <img src="${featuredImage.url}" alt="${featuredImage.altText}" width="${featuredImage.width}" height="${featuredImage.height}" />
</figure>`;

      const firstPTagIndex = modifiedHtml.indexOf("</p>");
      if (firstPTagIndex !== -1) {
        modifiedHtml =
          modifiedHtml.slice(0, firstPTagIndex + 4) +
          "\n" +
          featuredImageHtml +
          "\n" +
          modifiedHtml.slice(firstPTagIndex + 4);
      }
    }

    if (contentImages.length > 0) {
      const h2Regex = /<h2[^>]*>.*?<\/h2>/g;
      let match;
      const h2Positions: number[] = [];

      while ((match = h2Regex.exec(modifiedHtml)) !== null) {
        h2Positions.push(match.index + match[0].length);
      }

      const insertPositions = h2Positions.slice(0, contentImages.length);

      for (let i = insertPositions.length - 1; i >= 0; i--) {
        const image = contentImages[i];
        const imageHtml = `\n<figure class="wp-block-image size-large">
  <img src="${image.url}" alt="${image.altText}" width="${image.width}" height="${image.height}" />
</figure>\n`;

        const position = insertPositions[i];
        modifiedHtml =
          modifiedHtml.slice(0, position) +
          imageHtml +
          modifiedHtml.slice(position);
      }
    }

    return modifiedHtml;
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    config: AgentRetryConfig,
    phase: string = "unknown",
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = config.initialDelayMs;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const timeoutPromise = config.timeoutMs
          ? new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error("Agent execution timeout")),
                config.timeoutMs,
              ),
            )
          : null;

        const executionPromise = fn();
        const result = timeoutPromise
          ? await Promise.race([executionPromise, timeoutPromise])
          : await executionPromise;

        this.errorTracker.trackSuccess(config.agentName, attempt);
        return result;
      } catch (error) {
        lastError = error as Error;
        await this.errorTracker.trackError(
          config.agentName,
          phase,
          error,
          attempt,
          config.maxAttempts,
        );

        const isRetryable = this.isRetryableError(
          error,
          config.retryableErrors,
        );
        const hasMoreAttempts = attempt < config.maxAttempts;

        if (!isRetryable || !hasMoreAttempts) {
          throw lastError;
        }

        const currentDelay = Math.min(delay, config.maxDelayMs);
        await this.sleep(currentDelay);
        delay *= config.backoffMultiplier;
      }
    }

    throw (
      lastError ||
      new Error(
        `${config.agentName} failed after ${config.maxAttempts} attempts`,
      )
    );
  }

  private isRetryableError(
    error: unknown,
    retryableErrors: readonly string[],
  ): boolean {
    const err = error as Error & { code?: string };
    const message = err.message?.toLowerCase() || "";

    if (
      err.code &&
      retryableErrors.some((e) => e.toLowerCase() === err.code?.toLowerCase())
    ) {
      return true;
    }

    for (const retryableType of retryableErrors) {
      if (message.includes(retryableType.toLowerCase())) {
        return true;
      }
    }

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("socket")
    ) {
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getAIConfig(): AIClientConfig {
    return {
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    };
  }

  private calculateTotalTokenUsage(result: ArticleGenerationResult): {
    official: number;
    charged: number;
  } {
    let officialTotal = 0;
    let chargedTotal = 0;

    const phases = [
      result.research,
      result.strategy,
      result.writing,
      result.meta,
    ];

    for (const phase of phases) {
      if (!phase?.executionInfo) continue;
      const execInfo = phase.executionInfo as {
        tokenUsage?: { input: number; output: number };
        model?: string;
      };
      if (!execInfo.tokenUsage) continue;

      const rawTotal =
        (execInfo.tokenUsage.input || 0) + (execInfo.tokenUsage.output || 0);
      const multiplier = this.getModelMultiplier(execInfo.model);
      const charged = Math.ceil(rawTotal * multiplier * 1.5);

      officialTotal += rawTotal;
      chargedTotal += charged;
    }

    return { official: officialTotal, charged: chargedTotal };
  }

  private getModelMultiplier(modelName?: string): number {
    if (!modelName) return 1.0;
    const advancedModels = ["deepseek-reasoner", "claude-3-5-sonnet", "gpt-4"];
    return advancedModels.some((m) => modelName.includes(m)) ? 2.0 : 1.0;
  }

  private reconstructResultFromArticle(article: {
    id: string;
    title: string;
    slug: string;
    html_content: string;
    created_at: string;
  }): ArticleGenerationResult {
    return {
      success: true,
      articleJobId: "",
      savedArticle: {
        id: article.id,
        recommendationsCount: 0,
      },
      executionStats: {
        totalTime: 0,
        phases: {
          research: 0,
          strategy: 0,
          contentGeneration: 0,
          metaGeneration: 0,
        },
        parallelSpeedup: 1,
      },
    };
  }

  private async getBrandVoice(
    websiteId: string | null,
    companyId: string | null,
  ): Promise<BrandVoice> {
    const defaultBrandVoice: BrandVoice = {
      id: "",
      website_id: websiteId || "",
      tone_of_voice: "專業、友善、易懂",
      target_audience: "一般網路使用者",
      keywords: [],
      writing_style: {
        sentence_style: "mixed",
        interactivity_level: "medium",
        use_questions: true,
        examples_preference: "moderate",
      },
    };

    if (!websiteId || websiteId === "null") {
      return defaultBrandVoice;
    }

    const supabase = await this.getSupabase();
    const { data: website, error } = await supabase
      .from("website_configs")
      .select("brand_voice")
      .eq("id", websiteId)
      .single();

    if (error || !website?.brand_voice) {
      return defaultBrandVoice;
    }

    const bv = website.brand_voice as Record<string, unknown>;
    return {
      ...defaultBrandVoice,
      tone_of_voice:
        (bv.tone_of_voice as string) || defaultBrandVoice.tone_of_voice,
      target_audience:
        (bv.target_audience as string) || defaultBrandVoice.target_audience,
      brand_name: bv.brand_name as string | undefined,
    };
  }

  private async getWorkflowSettings(
    websiteId: string | null,
  ): Promise<WorkflowSettings> {
    const defaults: WorkflowSettings = {
      id: "",
      website_id: websiteId || "",
      serp_analysis_enabled: true,
      competitor_count: 10,
      content_length_min: 1000,
      content_length_max: 3000,
      keyword_density_min: 1,
      keyword_density_max: 3,
      quality_threshold: 80,
      auto_publish: false,
      serp_model: "perplexity-research",
      content_model: "deepseek-chat",
      meta_model: "deepseek-chat",
    };

    if (!websiteId || websiteId === "null") {
      return defaults;
    }

    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("workflow_settings")
      .select("*")
      .eq("website_id", websiteId)
      .limit(1);

    if (error || !data?.[0]) {
      return defaults;
    }

    return data[0];
  }

  private async getAgentConfig(websiteId: string | null): Promise<AgentConfig> {
    const defaults: AgentConfig = {
      research_model: "deepseek-reasoner",
      strategy_model: "deepseek-reasoner",
      writing_model: "deepseek-chat",
      image_model: "gemini-imagen",
      featured_image_model: "gemini-2.5-flash-image",
      content_image_model: "gpt-image-1-mini",
      research_temperature: 0.7,
      strategy_temperature: 0.7,
      writing_temperature: 0.7,
      research_max_tokens: 64000,
      strategy_max_tokens: 64000,
      writing_max_tokens: 64000,
      image_size: "1024x1024",
      image_count: 3,
      meta_enabled: true,
      meta_model: "deepseek-chat",
      meta_temperature: 0.7,
      meta_max_tokens: 64000,
    };

    if (!websiteId || websiteId === "null") {
      return defaults;
    }

    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("website_id", websiteId)
      .limit(1);

    if (error || !data?.[0]) {
      return defaults;
    }

    const config = data[0];
    return {
      ...defaults,
      research_model: config.research_model || defaults.research_model,
      strategy_model:
        config.complex_processing_model || defaults.strategy_model,
      writing_model: config.simple_processing_model || defaults.writing_model,
      image_model: config.image_model || defaults.image_model,
      research_temperature:
        config.research_temperature || defaults.research_temperature,
      strategy_temperature:
        config.strategy_temperature || defaults.strategy_temperature,
      writing_temperature:
        config.writing_temperature || defaults.writing_temperature,
      research_max_tokens:
        config.research_max_tokens || defaults.research_max_tokens,
      strategy_max_tokens:
        config.strategy_max_tokens || defaults.strategy_max_tokens,
      writing_max_tokens:
        config.writing_max_tokens || defaults.writing_max_tokens,
      image_size: config.image_size || defaults.image_size,
      image_count: config.image_count || defaults.image_count,
      meta_enabled: config.meta_enabled !== false,
      meta_model:
        config.meta_model ||
        config.simple_processing_model ||
        defaults.meta_model,
      meta_temperature: config.meta_temperature || defaults.meta_temperature,
      meta_max_tokens: config.meta_max_tokens || defaults.meta_max_tokens,
    };
  }

  private async getWebsiteSettings(websiteId: string | null): Promise<{
    language: string;
    industry: string | null;
    region: string;
  }> {
    const defaults = {
      language: "zh-TW",
      industry: null as string | null,
      region: "台灣",
    };

    if (!websiteId || websiteId === "null") {
      return defaults;
    }

    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from("website_configs")
      .select("language, industry, region")
      .eq("id", websiteId)
      .single();

    if (error || !data) {
      return defaults;
    }

    return {
      language: data.language || defaults.language,
      industry: data.industry || defaults.industry,
      region: data.region || defaults.region,
    };
  }

  private async getPreviousArticles(
    websiteId: string | null,
    currentArticleTitle: string,
  ): Promise<PreviousArticle[]> {
    if (!websiteId || websiteId === "null") {
      return [];
    }

    const supabase = await this.getSupabase();

    const { data: websiteConfig } = await supabase
      .from("website_configs")
      .select("wordpress_url")
      .eq("id", websiteId)
      .single();

    const baseUrl = websiteConfig?.wordpress_url || "";

    const { data, error } = await supabase
      .from("generated_articles")
      .select("id, title, slug, keywords, excerpt, wordpress_post_url, status")
      .eq("website_id", websiteId)
      .or("status.eq.published,status.eq.reviewed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return [];
    }

    return (data || []).map((article) => {
      const url =
        article.status === "published" && baseUrl
          ? `${baseUrl}/${article.slug}`
          : `/dashboard/articles/${article.id}/preview`;

      return {
        id: article.id,
        title: article.title,
        slug: article.slug || "",
        url,
        keywords: article.keywords || [],
        excerpt: article.excerpt || "",
      };
    });
  }

  private async getWordPressConfig(websiteId: string): Promise<{
    enabled: boolean;
    url: string;
    username: string;
    applicationPassword: string;
    accessToken?: string;
    refreshToken?: string;
  } | null> {
    const supabase = await this.getSupabase();
    const { data: configs, error } = await supabase
      .from("website_configs")
      .select(
        "wordpress_url, wp_username, wp_app_password, wp_enabled, wordpress_access_token, wordpress_refresh_token",
      )
      .eq("id", websiteId);

    if (error) {
      return null;
    }

    const data = configs?.[0];
    if (!data?.wp_enabled) {
      return null;
    }

    if (
      !data.wordpress_url ||
      (!data.wp_app_password && !data.wordpress_access_token)
    ) {
      return null;
    }

    return {
      enabled: true,
      url: data.wordpress_url,
      username: data.wp_username,
      applicationPassword: data.wp_app_password,
      accessToken: data.wordpress_access_token,
      refreshToken: data.wordpress_refresh_token,
    };
  }
}
