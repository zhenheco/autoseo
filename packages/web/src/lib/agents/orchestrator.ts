import { createAdminClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { ArticleStorageService } from "@/lib/services/article-storage";
import { ResearchAgent } from "./research-agent";
import { StrategyAgent } from "./strategy-agent";
import { WritingAgent } from "./writing-agent";
import { FeaturedImageAgent } from "./featured-image-agent";
import { ArticleImageAgent } from "./article-image-agent";
import { MetaAgent } from "./meta-agent";
import { LinkProcessorAgent } from "./link-processor-agent";
import { CompetitorAnalysisAgent } from "./competitor-analysis-agent";
import { CategoryAgent } from "./category-agent";
import { ContentPlanAgent } from "./content-plan-agent";
import { IntroductionAgent } from "./introduction-agent";
import { SectionAgent } from "./section-agent";
import { ConclusionAgent } from "./conclusion-agent";
import { QAAgent } from "./qa-agent";
import { ContentAssemblerAgent } from "./content-assembler-agent";
import { MaterialExtractorAgent } from "./material-extractor-agent";
import { MultiAgentOutputAdapter } from "./output-adapter";
import {
  shouldExtractMaterials,
  matchMaterials,
  distributeByRoundRobin,
} from "./writing-presets";
import { WordPressClient } from "@/lib/wordpress/client";
import { ErrorTracker } from "./error-tracker";
import { PipelineLogger } from "./pipeline-logger";
import { RetryConfigs, type AgentRetryConfig } from "./retry-config";
import {
  getBrandVoice,
  getWebsiteSettings,
  getWorkflowSettings,
  getAgentConfig,
  getPreviousArticles,
  getWordPressConfig,
  getAIConfig,
} from "./pipeline-helpers";
import type {
  ArticleGenerationInput,
  ArticleGenerationResult,
  BrandVoice,
  AgentConfig,
  PreviousArticle,
  AIClientConfig,
  GeneratedImage,
  SectionOutput,
  CompetitorAnalysisOutput,
  ContentPlanOutput,
  ContentContext,
  ResearchOutput,
  ResearchContext,
  ResearchSummary,
  MaterialsProfile,
} from "@/types/agents";
import { AgentExecutionContext } from "./base-agent";

export class ParallelOrchestrator {
  private supabaseClient?: SupabaseClient;
  private errorTracker: ErrorTracker;
  private pipelineLogger?: PipelineLogger;
  private currentJobId?: string;

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

  private setJobId(jobId: string, keyword: string, companyId: string): void {
    this.currentJobId = jobId;
    this.errorTracker = new ErrorTracker({
      ...this.errorTracker["options"],
      jobId,
      enableDatabaseTracking: true,
      getSupabase: () => this.getSupabase(),
    });

    this.pipelineLogger = new PipelineLogger({
      jobId,
      keyword,
      companyId,
      enableDatabaseSync: true,
      getSupabase: () => this.getSupabase(),
    });
  }

  private async getSupabase(): Promise<SupabaseClient> {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }
    return createAdminClient();
  }

  /**
   * 檢查任務是否已被取消
   */
  private async checkCancelled(jobId?: string): Promise<boolean> {
    if (!jobId) return false;
    const supabase = await this.getSupabase();
    const { data } = await supabase
      .from("article_jobs")
      .select("status")
      .eq("id", jobId)
      .single();
    return data?.status === "cancelled";
  }

  async execute(
    input: ArticleGenerationInput,
  ): Promise<ArticleGenerationResult> {
    const supabase = await this.getSupabase();
    const startTime = Date.now();

    if (input.articleJobId) {
      this.setJobId(input.articleJobId, input.title, input.companyId);
    }

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
      // 檢查是否有保存的狀態可以恢復
      const { data: jobData } = await supabase
        .from("article_jobs")
        .select("metadata, status")
        .eq("id", input.articleJobId)
        .single();

      // ✅ 檢查任務是否已被取消
      if (jobData?.status === "cancelled") {
        console.log("[Orchestrator] ⚠️ Job was cancelled, stopping execution", {
          jobId: input.articleJobId,
        });
        return result;
      }

      // ✅ 修復問題 1: 防止重複生成 - 檢查是否已生成文章
      if (jobData?.metadata?.saved_article_id) {
        console.log(
          "[Orchestrator] ⚠️ Using cached article, skipping token deduction",
          {
            articleId: jobData.metadata.saved_article_id,
            jobId: input.articleJobId,
            reason: "Article already generated (idempotency check)",
          },
        );

        const { data: existingArticle, error: loadError } = await supabase
          .from("generated_articles")
          .select("*")
          .eq("id", jobData.metadata.saved_article_id)
          .single();

        if (!loadError && existingArticle) {
          // 重構已生成的文章為 ArticleGenerationResult 格式
          console.log(
            "[Orchestrator] ✅ Returning existing article:",
            existingArticle.title,
          );
          return this.reconstructResultFromArticle(existingArticle);
        } else {
          console.warn(
            "[Orchestrator] ⚠️ saved_article_id exists but article not found, will regenerate",
          );
        }
      }

      let currentPhase = jobData?.metadata?.current_phase;
      const savedState = jobData?.metadata;

      console.log("[Orchestrator] 🔄 Checking resume state", {
        currentPhase,
        canResume: !!currentPhase,
        hasSavedArticle: !!jobData?.metadata?.saved_article_id,
      });

      const [
        brandVoice,
        workflowSettings,
        agentConfig,
        previousArticles,
        websiteSettings,
      ] = await Promise.all([
        getBrandVoice(supabase, input.websiteId),
        getWorkflowSettings(supabase, input.websiteId),
        getAgentConfig(supabase, input.websiteId),
        getPreviousArticles(
          supabase,
          input.websiteId,
          input.title,
          input.keywords,
        ),
        getWebsiteSettings(supabase, input.websiteId),
      ]);

      // 如果有 per-article writing style override，套用到 brandVoice
      if (input.writingStyleOverride) {
        brandVoice.writing_style = input.writingStyleOverride;
        console.log(
          `[Orchestrator] ✏️ Writing style overridden to: ${input.writingStyleOverride}`,
        );
      }

      const targetLanguage =
        input.targetLanguage ||
        input.language ||
        websiteSettings.language ||
        "zh-TW";
      const targetRegion = input.region || websiteSettings.region || "台灣";
      const targetIndustry = input.industry || websiteSettings.industry;

      console.log("[Orchestrator] 🌐 Website Settings:", {
        language: targetLanguage,
        region: targetRegion,
        industry: targetIndustry,
      });

      const aiConfig = getAIConfig();
      const context: AgentExecutionContext = {
        websiteId: input.websiteId,
        companyId: input.companyId,
        articleJobId: input.articleJobId,
      };

      console.log("[Orchestrator] 📋 Agent Models Configuration", {
        research_model: agentConfig.research_model,
        strategy_model: agentConfig.strategy_model,
        writing_model: agentConfig.writing_model,
        meta_model:
          agentConfig.meta_model ||
          agentConfig.simple_processing_model ||
          "deepseek-chat",
        image_model: agentConfig.image_model || "fal-ai/qwen-image",
      });

      // === 階段 1: Research & Strategy (初始階段) ===
      // 如果沒有 currentPhase，執行 Phase 1-2 然後返回
      let researchOutput;
      let strategyOutput;

      if (!currentPhase) {
        console.log(
          "[Orchestrator] 🚀 Starting Phase 1-2: Research & Strategy",
        );

        // Phase 1: Research
        this.pipelineLogger?.startPhase("research", { keyword: input.title });
        const phase1Start = Date.now();
        const researchAgent = new ResearchAgent(aiConfig, context);
        researchOutput = await researchAgent.execute({
          title: input.title,
          region: targetRegion,
          targetLanguage: targetLanguage,
          competitorCount: workflowSettings.competitor_count,
          model: agentConfig.research_model,
          temperature: agentConfig.research_temperature,
          maxTokens: agentConfig.research_max_tokens,
        });
        phaseTimings.research = Date.now() - phase1Start;
        result.research = researchOutput;
        this.pipelineLogger?.completePhase("research", {
          competitorCount: researchOutput.competitorAnalysis?.length || 0,
          externalRefsCount: researchOutput.externalReferences?.length || 0,
        });

        await this.updateJobStatus(input.articleJobId, "processing", {
          research: researchOutput,
          current_phase: "research_completed",
        });

        // 檢查是否已取消
        if (await this.checkCancelled(input.articleJobId)) {
          console.log(
            "[Orchestrator] ⚠️ Job cancelled after research phase, stopping",
          );
          return result;
        }

        // Phase 2: Strategy
        this.pipelineLogger?.startPhase("strategy");
        const phase2Start = Date.now();
        const strategyAgent = new StrategyAgent(aiConfig, context);
        strategyOutput = await strategyAgent.execute({
          researchData: researchOutput,
          brandVoice,
          targetWordCount:
            input.wordCount || workflowSettings.content_length_min,
          targetLanguage,
          industry: targetIndustry,
          region: targetRegion,
          model: agentConfig.strategy_model,
          temperature: agentConfig.strategy_temperature,
          maxTokens: agentConfig.strategy_max_tokens,
        });
        phaseTimings.strategy = Date.now() - phase2Start;
        result.strategy = strategyOutput;
        this.pipelineLogger?.completePhase("strategy", {
          selectedTitle: strategyOutput.selectedTitle,
          sectionsCount: strategyOutput.outline?.mainSections?.length || 0,
        });

        await this.updateJobStatus(input.articleJobId, "processing", {
          ...savedState,
          research: researchOutput,
          strategy: strategyOutput,
          current_phase: "strategy_completed",
        });

        // 檢查是否已取消
        if (await this.checkCancelled(input.articleJobId)) {
          console.log(
            "[Orchestrator] ⚠️ Job cancelled after strategy phase, stopping",
          );
          return result;
        }

        currentPhase = "strategy_completed";
        console.log(
          "[Orchestrator] ✅ Phase 1-2 completed, continuing to Phase 3",
        );
      } else {
        // 載入已保存的 research 和 strategy
        researchOutput = savedState?.research;
        strategyOutput = savedState?.strategy;
        result.research = researchOutput;
        result.strategy = strategyOutput;
      }

      // === 階段 2.5: 競爭對手分析（Persona-Driven 寫作準備） ===
      let competitorAnalysis: CompetitorAnalysisOutput | undefined;
      let contentPlan: ContentPlanOutput | undefined;
      let contentContext: ContentContext | undefined;
      let materialsProfile: MaterialsProfile | undefined;

      if (researchOutput && currentPhase === "strategy_completed") {
        try {
          console.log(
            "[Orchestrator] 🔍 Starting Competitor Analysis for Persona-Driven writing",
          );
          const competitorAgent = new CompetitorAnalysisAgent(
            aiConfig,
            context,
          );
          competitorAnalysis = await competitorAgent.execute({
            serpData: researchOutput,
            primaryKeyword: input.title,
            targetLanguage: targetLanguage,
            model: agentConfig.strategy_model,
            temperature: 0.3,
            maxTokens: 2000,
          });
          console.log("[Orchestrator] ✅ Competitor analysis completed", {
            differentiationAngle:
              competitorAnalysis.differentiationStrategy.contentAngle.substring(
                0,
                50,
              ) + "...",
            mustIncludeCount:
              competitorAnalysis.contentRecommendations.mustInclude.length,
          });
        } catch (competitorError) {
          console.warn(
            "[Orchestrator] ⚠️ Competitor analysis failed, continuing without it:",
            competitorError,
          );
          competitorAnalysis = undefined;
        }

        // === 階段 2.6: ContentPlanAgent + MaterialExtractor（並行） ===
        if (strategyOutput && researchOutput) {
          // 判斷是否需要素材萃取
          const needsMaterials = shouldExtractMaterials(
            brandVoice.writing_style,
          );
          console.log(
            "[Orchestrator] 📋 Starting ContentPlan" +
              (needsMaterials ? " + MaterialExtractor (parallel)" : ""),
          );

          // ContentPlan 和 MaterialExtractor 並行執行
          const contentPlanPromise = (async () => {
            const contentPlanAgent = new ContentPlanAgent(aiConfig, context);
            return contentPlanAgent.execute({
              strategy: strategyOutput,
              research: researchOutput,
              competitorAnalysis,
              brandVoice,
              targetLanguage,
              model: agentConfig.strategy_model,
              temperature: 0.4,
              maxTokens: 8000,
            });
          })();

          const materialPromise = needsMaterials
            ? (async () => {
                const materialAgent = new MaterialExtractorAgent(
                  aiConfig,
                  context,
                );
                return materialAgent.execute({
                  keyword: input.title,
                  deepResearch: researchOutput.deepResearch || {
                    trends: null,
                    userQuestions: null,
                    authorityData: null,
                  },
                  externalReferences: researchOutput.externalReferences || [],
                  targetLanguage,
                  model: agentConfig.strategy_model,
                  temperature: 0.3,
                  maxTokens: 4000,
                });
              })()
            : Promise.resolve(undefined);

          const [contentPlanResult, materialResult] = await Promise.allSettled([
            contentPlanPromise,
            materialPromise,
          ]);

          // 處理 ContentPlan 結果
          if (contentPlanResult.status === "fulfilled") {
            contentPlan = contentPlanResult.value;
            console.log("[Orchestrator] ✅ ContentPlan completed", {
              optimizedTitle: contentPlan.optimizedTitle.primary,
              mainSectionsCount:
                contentPlan.detailedOutline.mainSections.length,
              faqCount: contentPlan.detailedOutline.faq.questions.length,
            });

            contentContext = {
              primaryKeyword: researchOutput.title,
              selectedTitle:
                contentPlan.optimizedTitle?.primary ||
                strategyOutput.selectedTitle,
              searchIntent: researchOutput.searchIntent,
              targetAudience: brandVoice.target_audience,
              topicKeywords: strategyOutput.keywords.slice(0, 10),
              regionContext: targetRegion,
              industryContext: targetIndustry || undefined,
              brandName: brandVoice.brand_name,
              toneGuidance: contentPlan.contentStrategy.toneGuidance,
            };
          } else {
            console.warn(
              "[Orchestrator] ⚠️ ContentPlan failed:",
              contentPlanResult.reason,
            );
            contentContext = {
              primaryKeyword: researchOutput.title,
              selectedTitle: strategyOutput.selectedTitle,
              searchIntent: researchOutput.searchIntent,
              targetAudience: brandVoice.target_audience,
              topicKeywords: strategyOutput.keywords.slice(0, 10),
              regionContext: targetRegion,
              industryContext: targetIndustry || undefined,
              brandName: brandVoice.brand_name,
            };
          }

          // 處理 MaterialExtractor 結果
          if (materialResult.status === "fulfilled" && materialResult.value) {
            materialsProfile = materialResult.value;
            console.log("[Orchestrator] ✅ MaterialExtractor completed", {
              stories: materialsProfile.stories.length,
              statistics: materialsProfile.statistics.length,
              quotes: materialsProfile.quotes.length,
              cases: materialsProfile.cases.length,
              perplexitySufficient: materialsProfile.meta.perplexitySufficient,
              fetchedUrls: materialsProfile.meta.fetchedUrls,
            });
          } else if (materialResult.status === "rejected") {
            console.warn(
              "[Orchestrator] ⚠️ MaterialExtractor failed (non-blocking):",
              materialResult.reason,
            );
          }
        }
      }

      // === 階段 3: Content Generation (寫作+圖片) ===
      // 如果 currentPhase === 'strategy_completed'，執行 Phase 3 然後返回
      let writingOutput: ArticleGenerationResult["writing"];
      let imageOutput: ArticleGenerationResult["image"];

      if (currentPhase === "strategy_completed") {
        console.log(
          "[Orchestrator] 🚀 Starting Phase 3: Content & Image Generation",
        );

        const useMultiAgent = this.shouldUseMultiAgent(input);
        console.log(
          `[Orchestrator] Using ${useMultiAgent ? "Multi-Agent" : "Legacy"} architecture`,
        );

        const phase3Start = Date.now();

        if (useMultiAgent) {
          try {
            imageOutput = await this.executeImageAgent(
              strategyOutput,
              agentConfig,
              aiConfig,
              context,
            );

            await this.updateJobStatus(input.articleJobId, "processing", {
              ...savedState,
              current_phase: "images_completed",
              image: imageOutput,
            });

            // 檢查是否已取消
            if (await this.checkCancelled(input.articleJobId)) {
              console.log(
                "[Orchestrator] ⚠️ Job cancelled after images phase, stopping",
              );
              return result;
            }

            writingOutput = await this.executeContentGeneration(
              strategyOutput,
              imageOutput,
              brandVoice,
              agentConfig,
              aiConfig,
              context,
              targetLanguage,
              contentContext,
              contentPlan,
              researchOutput,
              materialsProfile,
            );

            console.log(
              "[Orchestrator] ✅ Multi-agent content generation succeeded",
            );
          } catch (multiAgentError) {
            console.error(
              "[Orchestrator] ❌ Multi-agent flow failed, falling back to legacy:",
              multiAgentError,
            );
            this.errorTracker.trackFallback(
              "multi-agent-to-legacy",
              multiAgentError,
            );

            const [legacyWriting, legacyImage] = await Promise.all([
              this.executeWritingAgent(
                strategyOutput,
                brandVoice,
                previousArticles,
                agentConfig,
                aiConfig,
                context,
                competitorAnalysis,
                targetLanguage,
                targetRegion,
              ),
              imageOutput ||
                this.executeImageAgent(
                  strategyOutput,
                  agentConfig,
                  aiConfig,
                  context,
                ),
            ]);

            writingOutput = legacyWriting;
            imageOutput = legacyImage;
          }
        } else {
          [writingOutput, imageOutput] = await Promise.all([
            this.executeWritingAgent(
              strategyOutput,
              brandVoice,
              previousArticles,
              agentConfig,
              aiConfig,
              context,
              competitorAnalysis,
              targetLanguage,
              targetRegion,
            ),
            this.executeImageAgent(
              strategyOutput,
              agentConfig,
              aiConfig,
              context,
            ),
          ]);
        }

        phaseTimings.contentGeneration = Date.now() - phase3Start;
        result.writing = writingOutput;
        result.image = imageOutput;

        await this.updateJobStatus(input.articleJobId, "processing", {
          ...savedState,
          writing: writingOutput,
          image: imageOutput,
          current_phase: "content_completed",
        });

        // 檢查是否已取消
        if (await this.checkCancelled(input.articleJobId)) {
          console.log(
            "[Orchestrator] ⚠️ Job cancelled after content phase, stopping",
          );
          return result;
        }

        // 更新 currentPhase 變數以繼續執行 Phase 4-6
        currentPhase = "content_completed";
        console.log(
          "[Orchestrator] ✅ Phase 3 completed, continuing to Phase 4-6",
        );
      } else {
        // 載入已保存的 writing 和 image
        writingOutput = savedState?.writing;
        imageOutput = savedState?.image;

        if (!writingOutput || !imageOutput) {
          throw new Error(
            "Cannot resume from content_completed phase: missing writing or image data",
          );
        }

        result.writing = writingOutput;
        result.image = imageOutput;
      }

      // === 階段 3: Meta, Quality & Publish (最終階段) ===
      console.log(
        "[Orchestrator] 🚀 Starting Phase 4-6: Meta, Quality & Publish",
      );

      // 重新計算 useMultiAgent 以判斷是否需要插入圖片
      const useMultiAgent = this.shouldUseMultiAgent(input);

      const phase4Start = Date.now();
      const metaAgent = new MetaAgent(aiConfig, context);

      let metaModel =
        agentConfig.meta_model ||
        agentConfig.simple_processing_model ||
        "deepseek-chat";
      if (metaModel === "gpt-3.5-turbo") {
        console.warn(
          "[Orchestrator] ⚠️ Replacing gpt-3.5-turbo with deepseek-chat for MetaAgent",
        );
        metaModel = "deepseek-chat";
      }

      const metaOutput = await metaAgent.execute({
        content: writingOutput,
        keyword: input.title,
        titleOptions: strategyOutput.titleOptions,
        model: metaModel,
        temperature: agentConfig.meta_temperature,
        maxTokens: agentConfig.meta_max_tokens,
        targetLanguage: targetLanguage,
      });
      phaseTimings.metaGeneration = Date.now() - phase4Start;
      result.meta = metaOutput;

      if (imageOutput?.featuredImage) {
        metaOutput.openGraph.image = imageOutput.featuredImage.url;
        metaOutput.twitterCard.image = imageOutput.featuredImage.url;
      }

      await this.updateJobStatus(input.articleJobId, "processing", {
        current_phase: "meta_completed",
        meta: metaOutput,
      });

      const linkProcessor = new LinkProcessorAgent();
      const htmlOutput = await linkProcessor.execute({
        html: writingOutput.html,
        internalLinks: previousArticles.map((a) => ({
          url: a.url,
          title: a.title,
          keywords: a.keywords,
        })),
        externalReferences: strategyOutput.externalReferences || [],
        targetLanguage: targetLanguage,
        primaryKeyword: input.title, // 文章主關鍵字，用於 fallback 匹配
      });

      writingOutput.html = htmlOutput.html;

      // HTML 後處理防護：移除 AI 可能仍然生成的醜陋參考來源格式
      writingOutput.html = this.sanitizeReferencePatterns(writingOutput.html);

      if (imageOutput) {
        writingOutput.html = this.insertImagesToHtml(
          writingOutput.html,
          imageOutput.featuredImage,
          imageOutput.contentImages,
        );
      }

      await this.updateJobStatus(input.articleJobId, "processing", {
        current_phase: "html_completed",
        html: htmlOutput,
      });

      // QualityAgent 已移除 - 品質檢查由其他 agents 負責

      // Phase 6: Category and Tag Selection
      const phase6Start = Date.now();

      // 先獲取 WordPress 配置，用於抓取現有分類和標籤
      const wordpressConfig = await getWordPressConfig(
        supabase,
        input.websiteId,
      );

      // 從 WordPress 抓取現有分類和標籤（如果配置了）
      let existingCategories: Array<{
        name: string;
        slug: string;
        count: number;
      }> = [];
      let existingTags: Array<{ name: string; slug: string; count: number }> =
        [];

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

          console.log(
            `[Orchestrator] 從 WordPress 獲取: ${existingCategories.length} 個分類, ${existingTags.length} 個標籤`,
          );
        } catch (wpError) {
          console.error(
            "[Orchestrator] 獲取 WordPress 分類/標籤失敗:",
            wpError,
          );
        }
      }

      // CategoryAgent 使用 DeepSeek 自己的 API
      // 如果 meta_model 不是 DeepSeek 模型，使用預設的 deepseek-chat
      let categoryModel = agentConfig.meta_model || "deepseek-chat";
      if (categoryModel.startsWith("deepseek/")) {
        categoryModel = categoryModel.replace("deepseek/", "");
      }
      // 如果不是 deepseek-chat 或 deepseek-reasoner，使用預設值
      if (!categoryModel.startsWith("deepseek-")) {
        categoryModel = "deepseek-chat";
      }
      // 移除 :free 等版本後綴，DeepSeek API 只接受 deepseek-chat 或 deepseek-reasoner
      categoryModel = categoryModel.replace(/:.*$/, "").replace(/-v[\d.]+/, "");
      console.log(
        `[Orchestrator] CategoryAgent model: ${agentConfig.meta_model} -> ${categoryModel}`,
      );
      const categoryAgent = new CategoryAgent(categoryModel);
      const categoryOutput = await categoryAgent.generateCategories({
        title: metaOutput.seo.title,
        content: writingOutput.html || writingOutput.markdown || "",
        keywords: [input.title, ...strategyOutput.keywords.slice(0, 5)],
        outline: strategyOutput,
        language: targetLanguage,
        existingCategories,
        existingTags,
      });
      result.category = categoryOutput;

      await this.updateJobStatus(input.articleJobId, "processing", {
        current_phase: "category_completed",
        category: categoryOutput,
      });

      // Phase 7: WordPress Direct Publish (只有 auto_publish=true 時才直接發布)
      // 方案 B：auto_publish=false 時，不發送到 WordPress，由 cron job 在排程時間到時處理
      if (wordpressConfig?.enabled && workflowSettings.auto_publish) {
        try {
          const wordpressClient = new WordPressClient(wordpressConfig);
          const publishResult = await wordpressClient.publishArticle(
            {
              title: metaOutput.seo.title,
              content: writingOutput.html || writingOutput.markdown || "",
              excerpt: metaOutput.seo.description,
              slug: metaOutput.slug,
              featuredImageUrl: imageOutput?.featuredImage?.url,
              categories: categoryOutput.categories.map((c) => c.name),
              tags: categoryOutput.tags.map((t) => t.name),
              seoTitle: metaOutput.seo.title,
              seoDescription: metaOutput.seo.description,
              focusKeyword: categoryOutput.focusKeywords[0] || input.title,
            },
            "publish", // auto_publish=true 時直接發布
          );

          result.wordpress = {
            postId: publishResult.post.id,
            postUrl: publishResult.post.link,
            status: publishResult.post.status,
          };

          await this.updateJobStatus(input.articleJobId, "processing", {
            current_phase: "wordpress_published",
            wordpress: result.wordpress,
          });
        } catch (wpError) {
          console.error("[Orchestrator] WordPress 發布失敗:", wpError);
          // 不中斷流程，WordPress 發布失敗不影響文章生成
        }
      }

      const totalTime = Date.now() - startTime;
      const serialTime =
        phaseTimings.research +
        phaseTimings.strategy +
        phaseTimings.contentGeneration +
        phaseTimings.metaGeneration;
      const parallelSpeedup = serialTime / totalTime;

      result.success = !!(result.writing && result.meta);
      result.executionStats = {
        totalTime,
        phases: phaseTimings,
        parallelSpeedup,
      };

      const finalStatus = result.success ? "completed" : "failed";
      await this.updateJobStatus(input.articleJobId, finalStatus, result);

      // Phase 8: 儲存文章到資料庫（如果生成成功或已發布到 WordPress）
      if (result.success || result.wordpress) {
        try {
          const articleStorage = new ArticleStorageService(supabase);

          // 取得 user ID：優先使用 input.userId，否則從認證取得，最後從 article_job 查詢
          let userId = input.userId;

          if (!userId) {
            const { data: userData } = await supabase.auth.getUser();
            userId = userData.user?.id;
          }

          // 如果仍然沒有 userId，從 article_job 的 company_members 查詢
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
            throw new Error("無法取得有效的 user_id，文章儲存失敗");
          }

          // 在儲存文章前，檢查 article_job 記錄是否存在
          const { data: existingJob } = await supabase
            .from("article_jobs")
            .select("id")
            .eq("id", input.articleJobId)
            .single();

          if (!existingJob) {
            // 只在記錄不存在時才建立
            const { error: insertError } = await supabase
              .from("article_jobs")
              .insert({
                id: input.articleJobId,
                job_id: input.articleJobId,
                company_id: input.companyId,
                website_id: input.websiteId,
                user_id: userId,
                keywords: input.title ? [input.title] : [],
                status: "completed",
                metadata: { message: "準備儲存文章到資料庫" },
              });

            if (insertError) {
              console.error("[Orchestrator] 建立 job 記錄失敗:", insertError);
              throw new Error(`建立 job 記錄失敗: ${insertError.message}`);
            }
          }
          console.log("[Orchestrator] Job 記錄已確認:", input.articleJobId);

          const savedArticle =
            await articleStorage.saveArticleWithRecommendations({
              articleJobId: input.articleJobId,
              result,
              websiteId: input.websiteId,
              companyId: input.companyId,
              userId,
            });

          console.log("[Orchestrator] 文章已儲存:", savedArticle.article.id);
          console.log(
            "[Orchestrator] 推薦數量:",
            savedArticle.recommendations.length,
          );

          // 更新 result 加入儲存資訊
          result.savedArticle = {
            id: savedArticle.article.id,
            recommendationsCount: savedArticle.recommendations.length,
          };

          // ✅ 篇數制扣款（取代原有 Token 制）
          console.log("[Orchestrator] 💳 Article quota deduction:", {
            jobId: input.articleJobId,
            companyId: input.companyId,
            articleId: savedArticle.article.id,
          });

          try {
            const { ArticleQuotaService } = await import(
              "@/lib/billing/article-quota-service"
            );
            const quotaService = new ArticleQuotaService(supabase);

            // 扣除 1 篇文章額度
            const deductResult = await quotaService.deductArticle(
              input.companyId,
              input.articleJobId,
              {
                title: result.meta?.seo.title,
                keywords: input.title ? [input.title] : undefined,
              },
            );

            if (deductResult.success) {
              // 消耗預扣
              await quotaService.consumeReservation(input.articleJobId);

              // 記錄扣款成功到 metadata（供審計追蹤）
              const successMetadata =
                (jobData?.metadata as Record<string, unknown>) || {};
              await supabase
                .from("article_jobs")
                .update({
                  metadata: {
                    ...successMetadata,
                    billing_status: "success",
                    deducted_from: deductResult.deductedFrom,
                    usage_log_id: deductResult.logId,
                    subscription_remaining: deductResult.subscriptionRemaining,
                    purchased_remaining: deductResult.purchasedRemaining,
                    deducted_at: new Date().toISOString(),
                  },
                })
                .eq("id", input.articleJobId);

              console.log("[Orchestrator] ✅ 文章額度已扣除:", {
                deductedFrom: deductResult.deductedFrom,
                subscriptionRemaining: deductResult.subscriptionRemaining,
                purchasedRemaining: deductResult.purchasedRemaining,
                totalRemaining: deductResult.totalRemaining,
              });
            } else {
              throw new Error(deductResult.error || "扣款失敗");
            }
          } catch (quotaError) {
            const errorMsg =
              quotaError instanceof Error
                ? quotaError.message
                : String(quotaError);
            console.error("[Orchestrator] ❌ 文章額度扣除失敗:", quotaError);
            // 記錄錯誤到 metadata（供每日審計發現），但不中斷流程
            const failMetadata =
              (jobData?.metadata as Record<string, unknown>) || {};
            const { error: updateError } = await supabase
              .from("article_jobs")
              .update({
                metadata: {
                  ...failMetadata,
                  billing_status: "failed",
                  billing_error: errorMsg,
                  billing_error_notice: "扣款失敗，請聯絡客服信箱處理",
                  billing_failed_at: new Date().toISOString(),
                },
              })
              .eq("id", input.articleJobId);

            if (updateError) {
              console.error(
                "[Orchestrator] ⚠️ 記錄扣款失敗狀態時發生錯誤:",
                updateError,
              );
            } else {
              console.log("[Orchestrator] ✅ 已記錄扣款失敗狀態到 metadata");
            }
          }

          // ✅ 修復問題 3: 更新 metadata.saved_article_id 防止重複生成
          // 重要：先取得最新的 metadata，確保不會覆蓋上面寫入的 billing_status
          const { data: latestJobData } = await supabase
            .from("article_jobs")
            .select("metadata")
            .eq("id", input.articleJobId)
            .single();

          // 確保 billing 相關欄位不會被覆蓋（篇數制欄位）
          const latestMeta = latestJobData?.metadata as Record<string, unknown>;
          const existingBillingFields = {
            billing_status: latestMeta?.billing_status,
            billing_error: latestMeta?.billing_error,
            billing_error_notice: latestMeta?.billing_error_notice,
            billing_failed_at: latestMeta?.billing_failed_at,
            deducted_from: latestMeta?.deducted_from,
            usage_log_id: latestMeta?.usage_log_id,
            subscription_remaining: latestMeta?.subscription_remaining,
            purchased_remaining: latestMeta?.purchased_remaining,
            deducted_at: latestMeta?.deducted_at,
          };

          await supabase
            .from("article_jobs")
            .update({
              metadata: {
                ...(latestJobData?.metadata || jobData?.metadata || {}),
                ...existingBillingFields, // 確保 billing 欄位不被覆蓋
                saved_article_id: savedArticle.article.id,
                generation_completed_at: new Date().toISOString(),
              },
            })
            .eq("id", input.articleJobId);

          console.log(
            "[Orchestrator] ✅ Metadata 已更新，saved_article_id:",
            savedArticle.article.id,
          );
        } catch (storageError) {
          console.error("[Orchestrator] 文章儲存失敗:", storageError);
          // 不中斷流程，儲存失敗不影響文章生成
        }
      }

      this.pipelineLogger?.complete();
      return result;
    } catch (error) {
      const err = error as Error;
      this.pipelineLogger?.fail(err.message);
      result.errors = { orchestrator: err };
      await this.updateJobStatus(input.articleJobId, "failed", result);
      throw error;
    }
  }

  private async executeWritingAgent(
    strategyOutput: ArticleGenerationResult["strategy"],
    brandVoice: BrandVoice,
    previousArticles: PreviousArticle[],
    agentConfig: AgentConfig,
    aiConfig: AIClientConfig,
    context: AgentExecutionContext,
    competitorAnalysis?: CompetitorAnalysisOutput,
    targetLanguage?: string,
    targetRegion?: string,
  ) {
    if (!strategyOutput) throw new Error("Strategy output is required");

    const writingAgent = new WritingAgent(aiConfig, context);
    return writingAgent.execute({
      strategy: strategyOutput,
      brandVoice,
      previousArticles,
      competitorAnalysis,
      model: agentConfig.writing_model,
      temperature: agentConfig.writing_temperature,
      maxTokens: agentConfig.writing_max_tokens,
      targetLanguage,
      targetRegion,
    });
  }

  private async executeImageAgent(
    strategyOutput: ArticleGenerationResult["strategy"],
    agentConfig: AgentConfig,
    aiConfig: AIClientConfig,
    context: AgentExecutionContext,
  ) {
    if (!strategyOutput) throw new Error("Strategy output is required");

    const featuredImageModel =
      agentConfig.featured_image_model || "fal-ai/qwen-image";
    const contentImageModel =
      agentConfig.content_image_model || "fal-ai/qwen-image";

    // 從 strategyOutput 取得 imageGuidance（圖片風格和文字建議）
    const imageGuidance = strategyOutput.imageGuidance;

    console.log("[Orchestrator] 🎨 Image models configuration:", {
      featuredImageModel,
      contentImageModel,
      usingSplitAgents: true,
      hasImageGuidance: !!imageGuidance,
      imageStyle: imageGuidance?.style?.substring(0, 50),
    });

    const featuredImageAgent = new FeaturedImageAgent(aiConfig, context);
    const articleImageAgent = new ArticleImageAgent(aiConfig, context);

    const [featuredResult, contentResult] = await Promise.all([
      featuredImageAgent.execute({
        title: strategyOutput.selectedTitle,
        model: featuredImageModel,
        quality: "medium" as const,
        size: agentConfig.image_size,
        imageStyle: imageGuidance?.style, // 從 Strategy 傳來的風格
        imageText: imageGuidance?.featuredImageText, // 特色圖片的文字
        articleContext: {
          outline:
            strategyOutput.outline?.mainSections?.map((s) => s.heading) || [],
          mainTopics:
            strategyOutput.outline?.mainSections
              ?.slice(0, 3)
              .map((s) => s.heading) || [],
          keywords: strategyOutput.keywords || [],
        },
      }),
      articleImageAgent.execute({
        title: strategyOutput.selectedTitle,
        outline: strategyOutput.outline,
        model: contentImageModel,
        quality: "medium" as const,
        size: agentConfig.image_size,
        imageStyle: imageGuidance?.style, // 從 Strategy 傳來的風格
        sectionImageTexts: imageGuidance?.sectionImageTexts, // 各段落的圖片文字
      }),
    ]);

    return {
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
  }

  private async executeContentGeneration(
    strategyOutput: ArticleGenerationResult["strategy"],
    imageOutput: ArticleGenerationResult["image"],
    brandVoice: BrandVoice,
    agentConfig: AgentConfig,
    aiConfig: AIClientConfig,
    context: AgentExecutionContext,
    targetLanguage: string = "zh-TW",
    contentContext?: ContentContext,
    contentPlan?: ContentPlanOutput,
    researchOutput?: ResearchOutput,
    materialsProfile?: MaterialsProfile,
  ) {
    if (!strategyOutput) throw new Error("Strategy output is required");

    const { outline, selectedTitle } = strategyOutput;

    // 從 researchOutput 提取研究數據，供各 writing agent 使用
    const deepResearch = researchOutput?.deepResearch;
    const referenceMapping = researchOutput?.referenceMapping;

    // 構建文章級研究摘要（給 IntroductionAgent 和 ConclusionAgent）
    const researchSummary: ResearchSummary | undefined = deepResearch
      ? {
          keyFindings:
            [
              deepResearch.authorityData?.content?.substring(0, 1200),
              deepResearch.trends?.content?.substring(0, 800),
            ]
              .filter(Boolean)
              .join("\n\n") || "",
          trendHighlight: deepResearch.trends?.content?.substring(0, 600) || "",
          topCitations: [
            ...(deepResearch.authorityData?.citations?.slice(0, 2) || []),
            ...(deepResearch.trends?.citations?.slice(0, 1) || []),
          ],
        }
      : undefined;

    // 構建 section 級研究上下文（根據 referenceMapping 分配數據到各 section）
    const buildSectionResearchContext = (
      sectionHeading: string,
      sectionIndex: number,
    ): ResearchContext | undefined => {
      if (!deepResearch && !referenceMapping) return undefined;

      const relevantRefs =
        referenceMapping?.filter((ref) =>
          ref.suggestedSections.some(
            (s) =>
              s.toLowerCase().includes(sectionHeading.toLowerCase()) ||
              sectionHeading.toLowerCase().includes(s.toLowerCase()),
          ),
        ) || [];

      // 從 deepResearch 中按 section index 分配段落
      const deepResearchContent = deepResearch?.authorityData?.content || "";
      const paragraphs = deepResearchContent
        .split("\n\n")
        .filter((p) => p.trim());
      const totalSections = outline.mainSections.length;
      const paragraphsPerSection = Math.max(
        1,
        Math.floor(paragraphs.length / totalSections),
      );
      const startIdx = sectionIndex * paragraphsPerSection;
      const relevantParagraphs = paragraphs
        .slice(startIdx, startIdx + paragraphsPerSection)
        .join("\n\n");

      const citations = [
        ...new Set([
          ...relevantRefs.map((r) => r.url),
          ...(deepResearch?.authorityData?.citations?.slice(0, 3) || []),
        ]),
      ];

      // 從 trends 提取統計數據
      const trendContent = deepResearch?.trends?.content || "";
      const statisticsMatches = trendContent.match(
        /\d+[\d.,]*%[^.。]*[.。]|[\d.,]+\s*(?:billion|million|萬|億)[^.。]*[.。]/gi,
      );
      const statistics = statisticsMatches?.slice(0, 3) || [];

      if (!relevantParagraphs && citations.length === 0) return undefined;

      // 匹配此段落可用的外部參考來源
      const sectionExternalRefs = (researchOutput?.externalReferences || [])
        .filter((ref) => {
          // 優先分配有 suggestedSections 匹配的
          const matchedMapping = referenceMapping?.find(
            (m) => m.url === ref.url,
          );
          if (matchedMapping) {
            return matchedMapping.suggestedSections.some(
              (s) =>
                s.toLowerCase().includes(sectionHeading.toLowerCase()) ||
                sectionHeading.toLowerCase().includes(s.toLowerCase()),
            );
          }
          return false;
        })
        .slice(0, 3);

      return {
        relevantData: relevantParagraphs,
        citations: citations.slice(0, 5),
        statistics,
        externalReferences:
          sectionExternalRefs.length > 0 ? sectionExternalRefs : undefined,
      };
    };

    // 研究亮點摘要（給 ConclusionAgent）
    const researchHighlights = deepResearch
      ? [
          deepResearch.authorityData?.content?.substring(0, 300),
          deepResearch.trends?.content?.substring(0, 200),
        ]
          .filter(Boolean)
          .join("\n\n")
      : undefined;

    // 用戶問題（給 QAAgent）
    const userQuestions = deepResearch?.userQuestions?.content;

    // 從 contentPlan 取得 specialBlocks（如果有的話）
    const sectionSpecialBlocks =
      contentPlan?.detailedOutline.mainSections.map((s) => s.specialBlock) ||
      [];

    const [introduction, conclusion, qa] = await Promise.all([
      this.executeWithRetry(
        async () => {
          const agent = new IntroductionAgent(aiConfig, context);
          return agent.execute({
            outline,
            featuredImage: imageOutput?.featuredImage || null,
            brandVoice,
            targetLanguage,
            contentContext,
            researchSummary,
            materialsProfile,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
            maxTokens: 500,
          });
        },
        RetryConfigs.INTRODUCTION_AGENT,
        "content_generation",
      ),
      this.executeWithRetry(
        async () => {
          const agent = new ConclusionAgent(aiConfig, context);
          return agent.execute({
            outline,
            brandVoice,
            targetLanguage,
            contentContext,
            researchHighlights,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
            maxTokens: 400,
          });
        },
        RetryConfigs.CONCLUSION_AGENT,
        "content_generation",
      ),
      this.executeWithRetry(
        async () => {
          const agent = new QAAgent(aiConfig, context);
          return agent.execute({
            title: selectedTitle,
            outline,
            brandVoice,
            targetLanguage,
            contentContext,
            userQuestions,
            count: contentPlan?.detailedOutline.faq.questions.length || 3,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
          });
        },
        RetryConfigs.QA_AGENT,
        "content_generation",
      ),
    ]);

    // 素材分配：先用 tag-based matching，匹配不到時 round-robin fallback
    const sectionCount = outline.mainSections.length;
    const contentPlanSections = contentPlan?.detailedOutline.mainSections || [];
    let sectionMaterialsList: (Partial<MaterialsProfile> | undefined)[] =
      Array(sectionCount).fill(undefined);

    if (materialsProfile) {
      sectionMaterialsList = outline.mainSections.map((section, i) => {
        const planSection = contentPlanSections[i];
        const matched = matchMaterials(
          {
            h2Title: section.heading,
            materialQuery: planSection?.materialQuery,
          },
          materialsProfile!,
        );
        // 如果匹配結果有內容，使用它；否則留 undefined 讓 fallback 處理
        const hasContent =
          (matched.stories?.length || 0) +
            (matched.statistics?.length || 0) +
            (matched.quotes?.length || 0) +
            (matched.cases?.length || 0) >
          0;
        return hasContent ? matched : undefined;
      });

      // Fallback: 如果超過一半的 sections 沒匹配到，用 round-robin
      const unmatchedCount = sectionMaterialsList.filter((m) => !m).length;
      if (unmatchedCount > sectionCount / 2) {
        console.log(
          "[Orchestrator] Tag matching insufficient, using round-robin fallback",
        );
        const distributed = distributeByRoundRobin(
          materialsProfile,
          sectionCount,
        );
        sectionMaterialsList = sectionMaterialsList.map(
          (m, i) => m || distributed[i],
        );
      }
    }

    const sections: SectionOutput[] = await Promise.all(
      outline.mainSections.map((section, i) => {
        const sectionImage = imageOutput?.contentImages?.[i] || null;
        const specialBlock = sectionSpecialBlocks[i];
        const sectionResearchContext = buildSectionResearchContext(
          section.heading,
          i,
        );

        return this.executeWithRetry(
          async () => {
            const agent = new SectionAgent(aiConfig, context);
            return agent.execute({
              section,
              previousSummary: undefined,
              sectionImage,
              brandVoice,
              targetLanguage,
              contentContext,
              specialBlock,
              researchContext: sectionResearchContext,
              sectionMaterials: sectionMaterialsList[i],
              index: i,
              model: agentConfig.writing_model,
              temperature: agentConfig.writing_temperature,
              maxTokens: Math.max(
                Math.floor(section.targetWordCount * 3),
                2000,
              ),
            });
          },
          RetryConfigs.SECTION_AGENT,
          "content_generation",
        );
      }),
    );

    const assembler = new ContentAssemblerAgent();
    const assembled = await assembler.execute({
      title: selectedTitle,
      introduction,
      sections,
      conclusion,
      qa,
    });

    // 使用 OutputAdapter 轉換為 WritingAgent 格式
    const adapter = new MultiAgentOutputAdapter();
    const writingOutput = await adapter.adapt({
      assemblerOutput: assembled,
      strategyOutput: {
        selectedTitle,
        outline,
        keywords: strategyOutput.keywords,
        targetSections:
          strategyOutput.internalLinkingStrategy?.targetSections || [],
        competitorAnalysis: [],
        contentGaps: [],
      },
      focusKeyword: selectedTitle, // 使用標題作為主要關鍵字
    });

    // 執行資訊（合併所有 agent 的 token 使用量）
    const totalTokenUsage = {
      input:
        (introduction.executionInfo.tokenUsage?.input || 0) +
        (conclusion.executionInfo.tokenUsage?.input || 0) +
        (qa.executionInfo.tokenUsage?.input || 0) +
        sections.reduce(
          (sum, s) => sum + (s.executionInfo.tokenUsage?.input || 0),
          0,
        ),
      output:
        (introduction.executionInfo.tokenUsage?.output || 0) +
        (conclusion.executionInfo.tokenUsage?.output || 0) +
        (qa.executionInfo.tokenUsage?.output || 0) +
        sections.reduce(
          (sum, s) => sum + (s.executionInfo.tokenUsage?.output || 0),
          0,
        ),
    };

    const totalExecutionTime =
      (introduction.executionInfo.executionTime || 0) +
      (conclusion.executionInfo.executionTime || 0) +
      (qa.executionInfo.executionTime || 0) +
      sections.reduce(
        (sum, s) => sum + (s.executionInfo.executionTime || 0),
        0,
      ) +
      assembled.executionInfo.executionTime;

    // 計算統計資料
    const plainText = assembled.html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const sentences = plainText
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);
    const paragraphs = assembled.html
      .split(/<\/p>/gi)
      .filter((p) => p.trim().length > 0);

    const statistics = {
      wordCount: assembled.statistics.totalWords,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      readingTime: Math.ceil(assembled.statistics.totalWords / 200), // 假設每分鐘 200 字
      averageSentenceLength:
        sentences.length > 0
          ? assembled.statistics.totalWords / sentences.length
          : 0,
    };

    // 將 InternalLink[] 轉換為 WritingOutput 格式
    const internalLinks = writingOutput.internalLinks.map((link) => ({
      anchor: link.anchor || link.title,
      url: link.url,
      section: "",
      articleId: "",
    }));

    // 構建符合 WritingOutput 類型的回傳
    return {
      markdown: writingOutput.markdown,
      html: writingOutput.html,
      statistics,
      internalLinks,
      keywordUsage: {
        count: writingOutput.keywordUsage.count,
        density: writingOutput.keywordUsage.density,
        distribution: [], // Multi-Agent 暫不支援分佈統計
      },
      readability: {
        fleschKincaidGrade: writingOutput.readability.fleschKincaidGrade,
        fleschReadingEase: writingOutput.readability.fleschReadingEase,
        gunningFogIndex: writingOutput.readability.gunningFog,
      },
      executionInfo: {
        model: agentConfig.writing_model,
        executionTime: totalExecutionTime,
        tokenUsage: totalTokenUsage,
      },
    };
  }

  private async updateJobStatus(
    articleJobId: string,
    status: string,
    data: Partial<ArticleGenerationResult> | Record<string, unknown>,
  ): Promise<void> {
    console.log(
      `[Orchestrator] 更新任務狀態: ${articleJobId.substring(0, 8)}... -> ${status}`,
    );

    const supabase = await this.getSupabase();

    // 先讀取現有的 metadata
    const { data: existingJob } = await supabase
      .from("article_jobs")
      .select("metadata")
      .eq("id", articleJobId)
      .single();

    const existingMetadata =
      (existingJob?.metadata as Record<string, unknown>) || {};

    // 驗證並格式化資料
    const validatedData = this.validateAndFormatStateData(data);

    // 合併 metadata，保留原有的 title、mode 等重要欄位
    const mergedMetadata = {
      ...existingMetadata,
      ...validatedData,
    };

    // 使用 update 只更新狀態和 metadata，不影響其他欄位
    const updateData: Record<string, unknown> = {
      status,
      metadata: mergedMetadata,
    };

    // 如果是 completed 或 failed，設定 completed_at
    if (status === "completed" || status === "failed") {
      updateData.completed_at = new Date().toISOString();
    }

    // 如果 data 包含 keywords，則更新 keywords
    if (data && typeof data === "object" && "keywords" in data) {
      updateData.keywords = data.keywords;
    }

    const { data: result, error } = await supabase
      .from("article_jobs")
      .update(updateData)
      .eq("id", articleJobId)
      .select();

    if (error) {
      console.error(`[Orchestrator] ❌ 更新狀態失敗:`, error);
      throw error;
    }

    console.log(`[Orchestrator] ✅ 狀態已更新:`, result);
  }

  /**
   * HTML 後處理防護：移除 AI 可能生成的醜陋參考來源格式
   */
  private sanitizeReferencePatterns(html: string): string {
    let sanitized = html;

    // 移除「延伸閱讀」獨立區塊（h2/h3 標題 + 後續的 ul/ol 列表）
    sanitized = sanitized.replace(
      /<h[23][^>]*>\s*(?:延伸閱讀|參考(?:來源|資料|文獻)|Further\s*Reading|References)\s*<\/h[23]>\s*(?:<[uo]l>[\s\S]*?<\/[uo]l>)?/gi,
      "",
    );

    // 移除「（參考來源：...）」格式的文字（含 HTML 連結）
    sanitized = sanitized.replace(
      /[（(]\s*參考來源\s*[：:]\s*(?:<a[^>]*>[\s\S]*?<\/a>|[^）)]*)\s*[）)]/gi,
      "",
    );

    // 移除包含保底引用的 <p><small>（參考來源：...）</small></p> 區塊
    sanitized = sanitized.replace(
      /<p>\s*<small>\s*[（(]\s*參考來源[\s\S]*?<\/small>\s*<\/p>/gi,
      "",
    );

    // 清理可能留下的空白行
    sanitized = sanitized.replace(/\n{3,}/g, "\n\n");

    return sanitized;
  }

  private insertImagesToHtml(
    html: string,
    featuredImage: GeneratedImage | null,
    contentImages: GeneratedImage[],
  ): string {
    let modifiedHtml = html;

    // 1. 在第一個 <p> 標籤之後插入精選圖片
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

    // 2. 智能分配內文圖片到 H2/H3 標題
    if (contentImages.length > 0) {
      // 找出所有 H2 和 H3 位置
      const h2Regex = /<h2[^>]*>.*?<\/h2>/g;
      const h3Regex = /<h3[^>]*>.*?<\/h3>/g;
      let match;
      const h2Positions: number[] = [];
      const h3Positions: number[] = [];

      while ((match = h2Regex.exec(modifiedHtml)) !== null) {
        h2Positions.push(match.index + match[0].length);
      }

      while ((match = h3Regex.exec(modifiedHtml)) !== null) {
        h3Positions.push(match.index + match[0].length);
      }

      // 計算分配策略
      const h2Count = h2Positions.length;
      const imageCount = contentImages.length;

      let insertPositions: number[] = [];

      if (imageCount <= Math.ceil(h2Count / 2)) {
        // 情況 1: 圖片數 ≤ H2數/2，每兩個 H2 放一張
        // 例如: 3個H2，2張圖 → 放在第1、第3個H2後
        const step = Math.max(1, Math.floor(h2Count / imageCount));
        for (let i = 0; i < imageCount && i * step < h2Count; i++) {
          insertPositions.push(h2Positions[i * step]);
        }
      } else if (imageCount <= h2Count) {
        // 情況 2: H2數/2 < 圖片數 ≤ H2數，優先填滿 H2
        // 例如: 3個H2，3張圖 → 每個H2後各放一張
        insertPositions = h2Positions.slice(0, imageCount);
      } else {
        // 情況 3: 圖片數 > H2數，先填滿 H2，剩餘放到 H3
        // 例如: 3個H2，5張圖 → 3張放H2，2張放H3
        insertPositions = [...h2Positions];
        const remainingImages = imageCount - h2Count;
        const h3ToUse = h3Positions.slice(0, remainingImages);
        insertPositions = [...insertPositions, ...h3ToUse].sort(
          (a, b) => a - b,
        );
      }

      // 從後往前插入，避免位置偏移
      for (
        let i = Math.min(insertPositions.length, imageCount) - 1;
        i >= 0;
        i--
      ) {
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
          console.error(
            `[Orchestrator] ${config.agentName} failed after ${attempt} attempts`,
            { error: lastError.message },
          );
          throw lastError;
        }

        const currentDelay = Math.min(delay, config.maxDelayMs);
        console.warn(
          `[Orchestrator] ${config.agentName} attempt ${attempt} failed, retrying in ${currentDelay}ms`,
          { error: lastError.message },
        );

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
    const err = error as Error & { code?: string; type?: string };
    const message = err.message?.toLowerCase() || "";

    // 1. 檢查錯誤碼（大小寫不敏感）
    if (
      err.code &&
      retryableErrors.some((e) => e.toLowerCase() === err.code?.toLowerCase())
    ) {
      return true;
    }

    // 2. 檢查錯誤訊息（部分匹配）
    for (const retryableType of retryableErrors) {
      if (message.includes(retryableType.toLowerCase())) {
        return true;
      }
    }

    // 3. 通用網路錯誤檢測
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

  private shouldUseMultiAgent(input: ArticleGenerationInput): boolean {
    const enabled = process.env.USE_MULTI_AGENT_ARCHITECTURE === "true";
    if (!enabled) {
      return false;
    }

    const rolloutPercentage = parseInt(
      process.env.MULTI_AGENT_ROLLOUT_PERCENTAGE || "100",
      10,
    );

    if (rolloutPercentage >= 100) {
      return true;
    }

    const hash = this.hashString(input.articleJobId);
    const bucket = hash % 100;

    return bucket < rolloutPercentage;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * 驗證並格式化狀態資料
   */
  private validateAndFormatStateData(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!data) return {};

    const validated = { ...data };

    // 確保 multiAgentState 結構正確
    if (validated.multiAgentState) {
      interface SectionState {
        markdown?: string;
        wordCount?: number;
      }
      interface MultiAgentState {
        introduction?: SectionState;
        sections?: SectionState[];
        conclusion?: SectionState;
        qa?: SectionState;
      }
      const multiState = validated.multiAgentState as MultiAgentState;

      // 驗證 introduction
      if (multiState.introduction && !multiState.introduction.markdown) {
        console.warn("[Orchestrator] Invalid introduction state, removing");
        delete multiState.introduction;
      }

      // 驗證 sections
      if (multiState.sections) {
        multiState.sections = multiState.sections.filter(
          (s: SectionState) => s && s.markdown && s.wordCount !== undefined,
        );
      }

      // 驗證 conclusion
      if (multiState.conclusion && !multiState.conclusion.markdown) {
        console.warn("[Orchestrator] Invalid conclusion state, removing");
        delete multiState.conclusion;
      }

      // 驗證 qa
      if (multiState.qa && !multiState.qa.markdown) {
        console.warn("[Orchestrator] Invalid QA state, removing");
        delete multiState.qa;
      }
    }

    // 限制 metadata 大小（< 100KB）
    const jsonString = JSON.stringify(validated);
    if (jsonString.length > 102400) {
      // 100KB
      console.warn("[Orchestrator] Metadata too large, truncating errors");
      // 移除舊的錯誤以減少大小
      const errors = validated.errors as unknown[];
      if (errors && errors.length > 5) {
        validated.errors = errors.slice(-5);
      }
    }

    return validated;
  }

  /**
   * 從資料庫已儲存的文章重構 ArticleGenerationResult
   * 用於冪等性檢查，避免重複生成
   */
  private reconstructResultFromArticle(
    article: Record<string, unknown>,
  ): ArticleGenerationResult {
    return {
      success: true,
      articleJobId: article.article_job_id as string,
      research: {
        title: article.title as string,
        region: "zh-TW",
        searchIntent: "informational" as const,
        intentConfidence: 0.8,
        topRankingFeatures: {
          contentLength: { min: 0, max: 0, avg: 0 },
          titlePatterns: [],
          structurePatterns: [],
          commonTopics: [],
          commonFormats: [],
        },
        contentGaps: [],
        competitorAnalysis: [],
        recommendedStrategy: "",
        relatedKeywords: [],
        externalReferences: [],
        executionInfo: {
          model: "cached",
          executionTime: 0,
          tokenUsage: { input: 0, output: 0 },
        },
      },
      strategy: {
        selectedTitle: article.title as string,
        titleOptions: [],
        keywords: [],
        outline: {
          introduction: {
            hook: "",
            context: "",
            thesis: "",
            wordCount: 0,
          },
          mainSections: [],
          conclusion: {
            summary: "",
            callToAction: "",
            wordCount: 0,
          },
          faq: [],
        },
        targetWordCount: (article.word_count as number) || 0,
        sectionWordDistribution: {
          introduction: 0,
          mainSections: 0,
          conclusion: 0,
          faq: 0,
        },
        keywordDensityTarget: 0,
        relatedKeywords: [],
        lsiKeywords: [],
        internalLinkingStrategy: {
          targetSections: [],
          suggestedTopics: [],
          minLinks: 0,
        },
        differentiationStrategy: {
          uniqueAngles: [],
          valueProposition: "",
          competitiveAdvantages: [],
        },
        externalReferences: [],
        executionInfo: {
          executionTime: 0,
          model: "cached",
          tokenUsage: { input: 0, output: 0 },
        },
      },
      writing: {
        markdown: article.markdown_content as string,
        html: article.html_content as string,
        statistics: {
          wordCount: article.word_count as number,
          readingTime: article.reading_time as number,
          paragraphCount: article.paragraph_count as number,
          sentenceCount: article.sentence_count as number,
          averageSentenceLength: 0,
        },
        internalLinks: [],
        keywordUsage: {
          density: article.keyword_density as number,
          count: article.keyword_usage_count as number,
          distribution: [],
        },
        readability: {
          fleschReadingEase: article.flesch_reading_ease as number,
          fleschKincaidGrade: article.flesch_kincaid_grade as number,
          gunningFogIndex: article.gunning_fog_index as number,
        },
        executionInfo: {
          executionTime: 0,
          model: "cached",
          tokenUsage: { input: 0, output: 0 },
        },
      },
      meta: {
        title: article.seo_title as string,
        description: article.seo_description as string,
        seo: {
          title: article.seo_title as string,
          description: article.seo_description as string,
          keywords: (article.keywords as string[]) || [],
        },
        slug: article.slug as string,
        focusKeyphrase: article.focus_keyword as string,
        openGraph: {
          title: article.og_title as string,
          description: article.og_description as string,
          type: "article" as const,
          image: article.og_image as string,
        },
        twitterCard: {
          card: "summary_large_image" as const,
          title: article.twitter_title as string,
          description: article.twitter_description as string,
          image: article.twitter_image as string,
        },
        executionInfo: {
          executionTime: 0,
          model: "cached",
          tokenUsage: { input: 0, output: 0 },
        },
      },
      savedArticle: {
        id: article.id as string,
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
}
