import { createAdminClient } from "@/lib/supabase/server";
import { SupabaseClient } from "@supabase/supabase-js";
import { ArticleStorageService } from "@/lib/services/article-storage";
import { ResearchAgent } from "./research-agent";
import { StrategyAgent } from "./strategy-agent";
import { WritingAgent } from "./writing-agent";
import { ImageAgent } from "./image-agent";
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
import { MultiAgentOutputAdapter } from "./output-adapter";
import { WordPressClient } from "@/lib/wordpress/client";
import { PerplexityClient } from "@/lib/perplexity/client";
import { getAPIRouter } from "@/lib/ai/api-router";
import { ErrorTracker } from "./error-tracker";
import { PipelineLogger } from "./pipeline-logger";
import { RetryConfigs, type AgentRetryConfig } from "./retry-config";
import type {
  ArticleGenerationInput,
  ArticleGenerationResult,
  BrandVoice,
  WorkflowSettings,
  AgentConfig,
  PreviousArticle,
  AIClientConfig,
  GeneratedImage,
  SectionOutput,
  ExternalReference,
  CompetitorAnalysisOutput,
  ContentPlanOutput,
  ContentContext,
} from "@/types/agents";
import type { AIModel } from "@/types/ai-models";
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
        this.getBrandVoice(input.websiteId, input.companyId),
        this.getWorkflowSettings(input.websiteId),
        this.getAgentConfig(input.websiteId),
        this.getPreviousArticles(input.websiteId, input.title),
        this.getWebsiteSettings(input.websiteId),
      ]);

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

      const aiConfig = this.getAIConfig();
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
        image_model: agentConfig.image_model || "gemini-imagen",
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
          region: input.region,
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

        // === 階段 2.6: ContentPlanAgent（詳細內容計畫） ===
        if (strategyOutput && researchOutput) {
          try {
            console.log("[Orchestrator] 📋 Starting ContentPlanAgent");
            const contentPlanAgent = new ContentPlanAgent(aiConfig, context);
            contentPlan = await contentPlanAgent.execute({
              strategy: strategyOutput,
              research: researchOutput,
              competitorAnalysis,
              brandVoice,
              targetLanguage,
              model: agentConfig.strategy_model,
              temperature: 0.4,
              maxTokens: 8000,
            });
            console.log("[Orchestrator] ✅ ContentPlan completed", {
              optimizedTitle: contentPlan.optimizedTitle.primary,
              mainSectionsCount:
                contentPlan.detailedOutline.mainSections.length,
              faqCount: contentPlan.detailedOutline.faq.questions.length,
            });

            // 構建 ContentContext 供 writing agents 使用
            // 優先使用 ContentPlan 的 optimizedTitle，否則 fallback 到 strategyOutput.selectedTitle
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
            console.log("[Orchestrator] ✅ ContentContext built", {
              primaryKeyword: contentContext.primaryKeyword,
              topicKeywordsCount: contentContext.topicKeywords.length,
            });
          } catch (contentPlanError) {
            console.warn(
              "[Orchestrator] ⚠️ ContentPlan failed, using fallback context:",
              contentPlanError,
            );
            // 即使 ContentPlan 失敗，也構建基本的 ContentContext
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
        targetLanguage: input.region?.startsWith("zh") ? "zh-TW" : "en",
        primaryKeyword: input.title, // 文章主關鍵字，用於 fallback 匹配
      });

      writingOutput.html = htmlOutput.html;

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
      const wordpressConfig = await this.getWordPressConfig(input.websiteId);

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
        language: input.region?.startsWith("zh") ? "zh-TW" : "en",
        existingCategories,
        existingTags,
      });
      result.category = categoryOutput;

      await this.updateJobStatus(input.articleJobId, "processing", {
        current_phase: "category_completed",
        category: categoryOutput,
      });

      // Phase 7: WordPress Direct Publish (如果配置了)
      if (wordpressConfig?.enabled) {
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
            workflowSettings.auto_publish ? "publish" : "draft",
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

          // ✅ 修復問題 2: Token 扣除
          const totalTokenUsage = this.calculateTotalTokenUsage(result);
          console.log("[Orchestrator] 📊 Token usage calculated:", {
            official: totalTokenUsage.official,
            charged: totalTokenUsage.charged,
            articleJobId: input.articleJobId,
            articleId: savedArticle.article.id,
            breakdown: {
              research: result.research?.executionInfo.tokenUsage,
              strategy: result.strategy?.executionInfo.tokenUsage,
              writing: result.writing?.executionInfo.tokenUsage,
              meta: result.meta?.executionInfo.tokenUsage,
            },
          });

          console.log("[Orchestrator] 💳 Token deduction decision:", {
            charged: totalTokenUsage.charged,
            willDeduct: totalTokenUsage.charged > 0,
            jobId: input.articleJobId,
            companyId: input.companyId,
            articleId: savedArticle.article.id,
          });

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
                  modelName: "multi-agent-generation",
                  articleTitle: result.meta?.seo.title,
                  breakdown: {
                    research: result.research?.executionInfo.tokenUsage,
                    strategy: result.strategy?.executionInfo.tokenUsage,
                    writing: result.writing?.executionInfo.tokenUsage,
                    meta: result.meta?.executionInfo.tokenUsage,
                    image: undefined, // ImageAgent 沒有 tokenUsage
                  },
                  totalOfficialTokens: totalTokenUsage.official,
                  totalChargedTokens: totalTokenUsage.charged,
                },
              });

              await tokenBillingService.consumeReservation(input.articleJobId);

              console.log("[Orchestrator] ✅ Token 已扣除，預扣已消耗:", {
                official: totalTokenUsage.official,
                charged: totalTokenUsage.charged,
              });
            } catch (tokenError) {
              console.error(
                "[Orchestrator] ⚠️ Token 扣除失敗（不影響文章生成）:",
                tokenError,
              );
              // 記錄錯誤但不中斷流程
              await supabase
                .from("article_jobs")
                .update({
                  metadata: {
                    ...(jobData?.metadata || {}),
                    token_deduction_error: (tokenError as Error).message,
                    token_deduction_attempted_at: new Date().toISOString(),
                  },
                })
                .eq("id", input.articleJobId);
            }
          }

          // ✅ 修復問題 3: 更新 metadata.saved_article_id 防止重複生成
          // 先取得最新的 metadata（包含可能的 token_deduction_error）
          const { data: latestJobData } = await supabase
            .from("article_jobs")
            .select("metadata")
            .eq("id", input.articleJobId)
            .single();

          await supabase
            .from("article_jobs")
            .update({
              metadata: {
                ...(latestJobData?.metadata || jobData?.metadata || {}),
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
      agentConfig.featured_image_model || "gemini-3-pro-image-preview";
    const contentImageModel =
      agentConfig.content_image_model || "gpt-image-1-mini";

    console.log("[Orchestrator] 🎨 Image models configuration:", {
      featuredImageModel,
      contentImageModel,
      usingSplitAgents: true,
    });

    const featuredImageAgent = new FeaturedImageAgent(aiConfig, context);
    const articleImageAgent = new ArticleImageAgent(aiConfig, context);

    const [featuredResult, contentResult] = await Promise.all([
      featuredImageAgent.execute({
        title: strategyOutput.selectedTitle,
        model: featuredImageModel,
        quality: "medium" as const,
        size: agentConfig.image_size,
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
  ) {
    if (!strategyOutput) throw new Error("Strategy output is required");

    const { outline, selectedTitle } = strategyOutput;

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
            count: contentPlan?.detailedOutline.faq.questions.length || 3,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
          });
        },
        RetryConfigs.QA_AGENT,
        "content_generation",
      ),
    ]);

    const sections: SectionOutput[] = await Promise.all(
      outline.mainSections.map((section, i) => {
        const sectionImage = imageOutput?.contentImages?.[i] || null;
        const specialBlock = sectionSpecialBlocks[i];

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
      brand_integration: {
        max_brand_mentions: 3,
        value_first: true,
      },
    };

    if (!websiteId || websiteId === "null") {
      console.warn("[Orchestrator] 無 websiteId，使用預設 brand_voice");
      return defaultBrandVoice;
    }

    const supabase = await this.getSupabase();
    const { data: website, error } = await supabase
      .from("website_configs")
      .select("brand_voice")
      .eq("id", websiteId)
      .single();

    if (error || !website?.brand_voice) {
      console.warn("[Orchestrator] 使用預設 brand_voice");
      return defaultBrandVoice;
    }

    const bv = website.brand_voice as {
      brand_name?: string;
      tone_of_voice?: string;
      target_audience?: string;
      writing_style?: string;
      sentence_style?: string;
      interactivity?: string;
      voice_examples?: {
        good_examples?: string[];
        bad_examples?: string[];
      };
    };
    console.log("[Orchestrator] 使用 website brand_voice", bv);
    return {
      id: "",
      website_id: websiteId,
      tone_of_voice: bv.tone_of_voice || defaultBrandVoice.tone_of_voice,
      target_audience: bv.target_audience || defaultBrandVoice.target_audience,
      keywords: [],
      sentence_style: bv.sentence_style || bv.writing_style || "清晰簡潔",
      interactivity: bv.interactivity || "適度互動",
      brand_name: bv.brand_name,
      voice_examples: bv.voice_examples?.good_examples
        ? {
            good_examples: bv.voice_examples.good_examples,
            bad_examples: bv.voice_examples.bad_examples,
          }
        : undefined,
      writing_style: {
        sentence_style:
          (bv.sentence_style as BrandVoice["writing_style"])?.sentence_style ||
          "mixed",
        interactivity_level: "medium",
        use_questions: true,
        examples_preference: "moderate",
      },
      brand_integration: {
        max_brand_mentions: 3,
        value_first: true,
      },
    };
  }

  private async getWebsiteSettings(
    websiteId: string | null,
  ): Promise<{ language: string; industry: string | null; region: string }> {
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
      console.warn("[Orchestrator] 使用預設網站設定");
      return defaults;
    }

    return {
      language: data.language || defaults.language,
      industry: data.industry || defaults.industry,
      region: data.region || defaults.region,
    };
  }

  private async getWorkflowSettings(
    websiteId: string | null,
  ): Promise<WorkflowSettings> {
    // 如果 websiteId 為 null，直接返回預設值
    if (!websiteId || websiteId === "null") {
      console.warn(
        "[Orchestrator] website_id 為 null，使用預設 workflow_settings",
      );
      return {
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
    }

    const supabase = await this.getSupabase();
    const { data: workflowSettings, error } = await supabase
      .from("workflow_settings")
      .select("*")
      .eq("website_id", websiteId);

    if (error) {
      console.error("[Orchestrator] 查詢 workflow_settings 失敗:", error);
      // 返回預設 workflow settings
      return {
        id: "",
        website_id: websiteId,
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
    }

    const workflowSetting = workflowSettings?.[0];
    if (!workflowSetting) {
      console.warn(
        "[Orchestrator] website_id 沒有對應的 workflow_settings，使用預設值",
      );
      return {
        id: "",
        website_id: websiteId,
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
    }

    return workflowSetting;
  }

  private async getAgentConfig(websiteId: string | null): Promise<
    AgentConfig & {
      complexModel?: AIModel;
      simpleModel?: AIModel;
      imageModelInfo?: AIModel;
      researchModelInfo?: AIModel;
    }
  > {
    // 如果 websiteId 為 null，直接返回預設配置
    if (!websiteId || websiteId === "null") {
      console.warn("[Orchestrator] website_id 為 null，使用預設 agent_configs");
      return this.getDefaultAgentConfig();
    }

    const supabase = await this.getSupabase();

    const { data: agentConfigs, error: configError } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("website_id", websiteId);

    const agentConfig = agentConfigs?.[0];

    if (configError) {
      console.error("[Orchestrator] 查詢 agent_configs 失敗:", configError);
      console.warn("[Orchestrator] 回滾到預設配置");
      return this.getDefaultAgentConfig();
    }

    if (!agentConfig) {
      console.warn(
        "[Orchestrator] website_id 沒有對應的 agent_configs，使用預設配置",
      );
      return this.getDefaultAgentConfig();
    }

    const modelIds = [
      agentConfig.complex_processing_model,
      agentConfig.simple_processing_model,
      agentConfig.image_model,
      agentConfig.research_model,
    ].filter(Boolean);

    const { data: models, error: modelsError } = await supabase
      .from("ai_models")
      .select("*")
      .in("model_id", modelIds);

    if (modelsError) {
      console.error("[Orchestrator] 查詢 ai_models 失敗:", modelsError);
    }

    const modelsMap = new Map<string, AIModel>();
    (models || []).forEach((model: AIModel) => {
      modelsMap.set(model.model_id, model);
    });

    return {
      complex_processing_model: agentConfig.complex_processing_model,
      simple_processing_model: agentConfig.simple_processing_model,

      research_model:
        agentConfig.research_model ||
        agentConfig.complex_processing_model ||
        "deepseek-reasoner",
      strategy_model:
        agentConfig.complex_processing_model || "deepseek-reasoner",
      writing_model: agentConfig.simple_processing_model || "deepseek-chat",
      image_model: agentConfig.image_model || "gemini-imagen",

      research_temperature: agentConfig.research_temperature || 0.7,
      strategy_temperature: agentConfig.strategy_temperature || 0.7,
      writing_temperature: agentConfig.writing_temperature || 0.7,
      research_max_tokens: agentConfig.research_max_tokens || 64000,
      strategy_max_tokens: agentConfig.strategy_max_tokens || 64000,
      writing_max_tokens: agentConfig.writing_max_tokens || 64000,

      image_size: agentConfig.image_size || "1024x1024",
      image_count: agentConfig.image_count || 3,

      meta_enabled: agentConfig.meta_enabled !== false,
      meta_model:
        agentConfig.meta_model ||
        agentConfig.simple_processing_model ||
        "deepseek-chat",
      meta_temperature: agentConfig.meta_temperature || 0.7,
      meta_max_tokens: agentConfig.meta_max_tokens || 16000,

      complexModel: modelsMap.get(agentConfig.complex_processing_model),
      simpleModel: modelsMap.get(agentConfig.simple_processing_model),
      imageModelInfo: modelsMap.get(agentConfig.image_model),
      researchModelInfo: modelsMap.get(agentConfig.research_model),
    };
  }

  private async ensureAgentConfigExists(
    websiteId: string,
  ): Promise<AgentConfig | null> {
    const supabase = await this.getSupabase();

    try {
      const { data: existing } = await supabase
        .from("agent_configs")
        .select("*")
        .eq("website_id", websiteId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log("[Orchestrator] agent_configs 已存在");
        return existing[0];
      }

      const defaultConfig = {
        website_id: websiteId,
        research_model: "deepseek-reasoner",
        complex_processing_model: "deepseek-chat",
        simple_processing_model: "deepseek-chat",
        image_model: "gemini-imagen",
        research_temperature: 0.7,
        research_max_tokens: 16000,
        strategy_temperature: 0.7,
        strategy_max_tokens: 16000,
        writing_temperature: 0.7,
        writing_max_tokens: 16000,
        image_size: "1024x1024",
        image_count: 3,
        meta_enabled: true,
        meta_model: "deepseek-chat",
        meta_temperature: 0.7,
        meta_max_tokens: 16000,
      };

      console.log(
        "[Orchestrator] 正在為 website_id 創建 agent_configs:",
        websiteId,
      );

      const { data: created, error: createError } = await supabase
        .from("agent_configs")
        .insert(defaultConfig)
        .select("*")
        .single();

      if (createError) {
        console.error("[Orchestrator] 創建 agent_configs 失敗:", createError);
        return null;
      }

      console.log("[Orchestrator] agent_configs 已成功創建:", websiteId);
      return created;
    } catch (error) {
      console.error("[Orchestrator] ensureAgentConfigExists 出錯:", error);
      return null;
    }
  }

  private async getPreviousArticles(
    websiteId: string | null,
    currentArticleTitle: string,
  ): Promise<PreviousArticle[]> {
    // 如果 websiteId 為 null，返回空陣列（沒有網站就沒有歷史文章）
    if (!websiteId || websiteId === "null") {
      console.warn("[Orchestrator] website_id 為 null，返回空的歷史文章列表");
      return [];
    }

    const supabase = await this.getSupabase();

    // 1. 取得網站基礎 URL
    const { data: websiteConfig } = await supabase
      .from("website_configs")
      .select("wordpress_url")
      .eq("id", websiteId)
      .single();

    const baseUrl = websiteConfig?.wordpress_url || "";

    // 2. 使用全文搜尋查詢相關文章
    const { data, error } = await supabase
      .from("generated_articles")
      .select("id, title, slug, keywords, excerpt, wordpress_post_url, status")
      .eq("website_id", websiteId)
      .or("status.eq.published,status.eq.reviewed")
      .textSearch("title", currentArticleTitle, {
        type: "websearch",
        config: "simple",
      })
      .limit(20);

    if (error) {
      console.error("[Orchestrator] 查詢相關文章失敗:", error);
      return [];
    }

    console.log(`[Orchestrator] 找到 ${data?.length || 0} 篇相關文章`, {
      websiteId,
      searchTitle: currentArticleTitle,
      baseUrl,
    });

    // 3. 構建 URL（已發佈用網站網址，未發佈用預覽 URL）
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

  private getDefaultAgentConfig(): AgentConfig & {
    complexModel?: AIModel;
    simpleModel?: AIModel;
    imageModelInfo?: AIModel;
    researchModelInfo?: AIModel;
  } {
    return {
      complex_processing_model: "deepseek-chat",
      simple_processing_model: "deepseek-chat",
      research_model: "deepseek-reasoner",
      strategy_model: "deepseek-chat",
      writing_model: "deepseek-chat",
      image_model: "gemini-imagen",
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
  }

  private getAIConfig(): AIClientConfig {
    return {
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    };
  }

  private async getWordPressConfig(websiteId: string): Promise<{
    enabled: boolean;
    url: string;
    username: string;
    applicationPassword: string;
    accessToken?: string;
    refreshToken?: string;
  } | null> {
    // 驗證 websiteId 是有效的 UUID
    if (
      !websiteId ||
      websiteId === "null" ||
      websiteId === "undefined" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        websiteId,
      )
    ) {
      return null;
    }

    const supabase = await this.getSupabase();
    const { data: configs, error } = await supabase
      .from("website_configs")
      .select(
        "wordpress_url, wp_username, wp_app_password, wp_enabled, wordpress_access_token, wordpress_refresh_token",
      )
      .eq("id", websiteId);

    if (error) {
      console.error("[Orchestrator] 查詢 website_configs 失敗:", error);
      return null;
    }

    const data = configs?.[0];
    if (!data?.wp_enabled) {
      return null;
    }

    // 確保配置格式正確
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
   * 取得模型的倍率
   * advanced 模型 (如 deepseek-reasoner) = 2.0x
   * basic 模型 (如 deepseek-chat) = 1.0x
   */
  private getModelMultiplier(modelName?: string): number {
    if (!modelName) return 1.0;
    const advancedModels = ["deepseek-reasoner", "claude-3-5-sonnet", "gpt-4"];
    return advancedModels.some((m) => modelName.includes(m)) ? 2.0 : 1.0;
  }

  /**
   * 計算所有 AI 調用的總 Token 使用量
   * 用於 Token 扣除
   *
   * 計費公式：實際扣除 = 官方 Token × 模型倍率 × 20%
   */
  private calculateTotalTokenUsage(result: ArticleGenerationResult): {
    official: number;
    charged: number;
  } {
    let officialTotal = 0;
    let chargedTotal = 0;

    const phaseNames = ["research", "strategy", "writing", "meta", "image"];
    const phases = [
      result.research,
      result.strategy,
      result.writing,
      result.meta,
      result.image,
    ];

    console.log("[Orchestrator] 📊 calculateTotalTokenUsage - 開始計算");

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const phaseName = phaseNames[i];

      if (!phase) {
        console.log(`[Orchestrator]   ${phaseName}: ❌ phase 不存在`);
        continue;
      }

      if (!phase.executionInfo) {
        console.log(`[Orchestrator]   ${phaseName}: ❌ executionInfo 不存在`);
        continue;
      }

      const execInfo = phase.executionInfo;

      if (!("tokenUsage" in execInfo) || !execInfo.tokenUsage) {
        continue;
      }

      const tokenUsage = execInfo.tokenUsage as {
        input: number;
        output: number;
        charged?: number;
      };
      const rawTotal = (tokenUsage.input || 0) + (tokenUsage.output || 0);

      // 取得模型倍率
      const modelName =
        "model" in execInfo ? (execInfo.model as string) : undefined;
      const multiplier = this.getModelMultiplier(modelName);

      // 計費公式：官方 Token × 模型倍率 × 20%
      const charged = Math.ceil(rawTotal * multiplier * 0.2);

      officialTotal += rawTotal;
      chargedTotal += charged;

      console.log(
        `[Orchestrator]   ${phaseName}: ✅ model=${modelName}, raw=${rawTotal}, multiplier=${multiplier}, charged=${charged}`,
      );
    }

    console.log(
      `[Orchestrator] 📊 calculateTotalTokenUsage - 完成: official=${officialTotal}, charged=${chargedTotal}`,
    );

    return {
      official: officialTotal,
      charged: chargedTotal,
    };
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
