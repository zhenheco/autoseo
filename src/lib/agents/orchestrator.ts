import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { ArticleStorageService } from '@/lib/services/article-storage';
import { ResearchAgent } from './research-agent';
import { StrategyAgent } from './strategy-agent';
import { WritingAgent } from './writing-agent';
import { ImageAgent } from './image-agent';
import { MetaAgent } from './meta-agent';
import { HTMLAgent } from './html-agent';
import { CategoryAgent } from './category-agent';
import { IntroductionAgent } from './introduction-agent';
import { SectionAgent } from './section-agent';
import { ConclusionAgent } from './conclusion-agent';
import { QAAgent } from './qa-agent';
import { ContentAssemblerAgent } from './content-assembler-agent';
import { WordPressClient } from '@/lib/wordpress/client';
import { PerplexityClient } from '@/lib/perplexity/client';
import { getAPIRouter } from '@/lib/ai/api-router';
import { ErrorTracker } from './error-tracker';
import { RetryConfigs, type AgentRetryConfig } from './retry-config';
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
} from '@/types/agents';
import type { AIModel } from '@/types/ai-models';
import { AgentExecutionContext } from './base-agent';

export class ParallelOrchestrator {
  private supabaseClient?: SupabaseClient;
  private errorTracker: ErrorTracker;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;
    this.errorTracker = new ErrorTracker({
      enableLogging: true,
      enableMetrics: true,
      enableExternalTracking: process.env.ERROR_TRACKING_ENABLED === 'true',
      maxErrorsInMemory: 100,
    });
  }

  private async getSupabase(): Promise<SupabaseClient> {
    if (this.supabaseClient) {
      return this.supabaseClient;
    }
    return await createClient();
  }

  async execute(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
    const supabase = await this.getSupabase();
    const startTime = Date.now();
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
        .from('article_jobs')
        .select('metadata, status')
        .eq('id', input.articleJobId)
        .single();

      const currentPhase = jobData?.metadata?.current_phase;
      const savedState = jobData?.metadata;

      console.log('[Orchestrator] 🔄 Checking resume state', {
        currentPhase,
        canResume: !!currentPhase,
      });

      const [brandVoice, workflowSettings, agentConfig, previousArticles] =
        await Promise.all([
          this.getBrandVoice(input.websiteId),
          this.getWorkflowSettings(input.websiteId),
          this.getAgentConfig(input.websiteId),
          this.getPreviousArticles(input.websiteId),
        ]);

      const aiConfig = this.getAIConfig();
      const context: AgentExecutionContext = {
        websiteId: input.websiteId,
        companyId: input.companyId,
        articleJobId: input.articleJobId,
      };

      console.log('[Orchestrator] 📋 Agent Models Configuration', {
        research_model: agentConfig.research_model,
        strategy_model: agentConfig.strategy_model,
        writing_model: agentConfig.writing_model,
        meta_model: agentConfig.meta_model || agentConfig.simple_processing_model || 'deepseek-chat',
        image_model: agentConfig.image_model || 'gpt-image-1-mini',
      });

      // === 階段 1: Research & Strategy (初始階段) ===
      // 如果沒有 currentPhase，執行 Phase 1-2 然後返回
      let researchOutput;
      let strategyOutput;

      if (!currentPhase) {
        console.log('[Orchestrator] 🚀 Starting Phase 1-2: Research & Strategy');

        // Phase 1: Research
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

        await this.updateJobStatus(input.articleJobId, 'processing', {
          research: researchOutput,
          current_phase: 'research_completed',
        });

        // Phase 2: Strategy
        const phase2Start = Date.now();
        const strategyAgent = new StrategyAgent(aiConfig, context);
        strategyOutput = await strategyAgent.execute({
          researchData: researchOutput,
          brandVoice,
          targetWordCount: workflowSettings.content_length_min,
          model: agentConfig.strategy_model,
          temperature: agentConfig.strategy_temperature,
          maxTokens: agentConfig.strategy_max_tokens,
        });
        phaseTimings.strategy = Date.now() - phase2Start;
        result.strategy = strategyOutput;

        await this.updateJobStatus(input.articleJobId, 'processing', {
          ...savedState,
          research: researchOutput,
          strategy: strategyOutput,
          current_phase: 'strategy_completed',
        });

        console.log('[Orchestrator] ✅ Phase 1-2 completed, continuing to Phase 3');
      } else {
        // 載入已保存的 research 和 strategy
        researchOutput = savedState?.research;
        strategyOutput = savedState?.strategy;
        result.research = researchOutput;
        result.strategy = strategyOutput;
      }

      // === 階段 2: Content Generation (寫作+圖片) ===
      // 如果 currentPhase === 'strategy_completed'，執行 Phase 3 然後返回
      let writingOutput: ArticleGenerationResult['writing'];
      let imageOutput: ArticleGenerationResult['image'];

      if (currentPhase === 'strategy_completed') {
        console.log('[Orchestrator] 🚀 Starting Phase 3: Content & Image Generation');

        const useMultiAgent = this.shouldUseMultiAgent(input);
        console.log(`[Orchestrator] Using ${useMultiAgent ? 'Multi-Agent' : 'Legacy'} architecture`);

        const phase3Start = Date.now();

        if (useMultiAgent) {
          try {
            imageOutput = await this.executeImageAgent(
              strategyOutput,
              agentConfig,
              aiConfig,
              context
            );

            await this.updateJobStatus(input.articleJobId, 'processing', {
              ...savedState,
              current_phase: 'images_completed',
              image: imageOutput,
            });

            writingOutput = await this.executeContentGeneration(
              strategyOutput,
              imageOutput,
              brandVoice,
              agentConfig,
              aiConfig,
              context
            );

            console.log('[Orchestrator] ✅ Multi-agent content generation succeeded');
          } catch (multiAgentError) {
            console.error('[Orchestrator] ❌ Multi-agent flow failed, falling back to legacy:', multiAgentError);
            this.errorTracker.trackFallback('multi-agent-to-legacy', multiAgentError);

            const [legacyWriting, legacyImage] = await Promise.all([
              this.executeWritingAgent(
                strategyOutput,
                brandVoice,
                previousArticles,
                agentConfig,
                aiConfig,
                context
              ),
              imageOutput || this.executeImageAgent(
                strategyOutput,
                agentConfig,
                aiConfig,
                context
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
              context
            ),
            this.executeImageAgent(
              strategyOutput,
              agentConfig,
              aiConfig,
              context
            ),
          ]);
        }

        phaseTimings.contentGeneration = Date.now() - phase3Start;
        result.writing = writingOutput;
        result.image = imageOutput;

        await this.updateJobStatus(input.articleJobId, 'processing', {
          ...savedState,
          writing: writingOutput,
          image: imageOutput,
          current_phase: 'content_completed',
        });

        console.log('[Orchestrator] ✅ Phase 3 completed, continuing to Phase 4-6');
      } else {
        // 載入已保存的 writing 和 image
        writingOutput = savedState?.writing;
        imageOutput = savedState?.image;

        if (!writingOutput || !imageOutput) {
          throw new Error('Cannot resume from content_completed phase: missing writing or image data');
        }

        result.writing = writingOutput;
        result.image = imageOutput;
      }

      // === 階段 3: Meta, Quality & Publish (最終階段) ===
      console.log('[Orchestrator] 🚀 Starting Phase 4-6: Meta, Quality & Publish');

      // 重新計算 useMultiAgent 以判斷是否需要插入圖片
      const useMultiAgent = this.shouldUseMultiAgent(input);

      const phase4Start = Date.now();
      const metaAgent = new MetaAgent(aiConfig, context);

      let metaModel = agentConfig.meta_model || agentConfig.simple_processing_model || 'deepseek-chat';
      if (metaModel === 'gpt-3.5-turbo') {
        console.warn('[Orchestrator] ⚠️ Replacing gpt-3.5-turbo with deepseek-chat for MetaAgent');
        metaModel = 'deepseek-chat';
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

      await this.updateJobStatus(input.articleJobId, 'processing', {
        current_phase: 'meta_completed',
        meta: metaOutput,
      });

      const htmlAgent = new HTMLAgent(aiConfig, context);
      const htmlOutput = await htmlAgent.execute({
        html: writingOutput.html,
        internalLinks: previousArticles.map((article) => ({
          url: article.url,
          title: article.title,
          keywords: article.keywords,
        })),
        externalReferences: strategyOutput.externalReferences || [],
      });

      writingOutput.html = htmlOutput.html;

      if (!useMultiAgent && imageOutput) {
        writingOutput.html = this.insertImagesToHtml(
          writingOutput.html,
          imageOutput.featuredImage,
          imageOutput.contentImages
        );
      }

      await this.updateJobStatus(input.articleJobId, 'processing', {
        current_phase: 'html_completed',
        html: htmlOutput,
      });

      // QualityAgent 已移除 - 品質檢查由其他 agents 負責

      // Phase 6: Category and Tag Selection
      const phase6Start = Date.now();

      // 先獲取 WordPress 配置，用於抓取現有分類和標籤
      const wordpressConfig = await this.getWordPressConfig(input.websiteId);

      // 從 WordPress 抓取現有分類和標籤（如果配置了）
      let existingCategories: Array<{ name: string; slug: string; count: number }> = [];
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

          console.log(
            `[Orchestrator] 從 WordPress 獲取: ${existingCategories.length} 個分類, ${existingTags.length} 個標籤`
          );
        } catch (wpError) {
          console.error('[Orchestrator] 獲取 WordPress 分類/標籤失敗:', wpError);
        }
      }

      // CategoryAgent 使用 DeepSeek 自己的 API
      // 如果 meta_model 不是 DeepSeek 模型，使用預設的 deepseek-chat
      let categoryModel = agentConfig.meta_model || 'deepseek-chat';
      if (categoryModel.startsWith('deepseek/')) {
        categoryModel = categoryModel.replace('deepseek/', '');
      }
      // 如果不是 deepseek-chat 或 deepseek-reasoner，使用預設值
      if (!categoryModel.startsWith('deepseek-')) {
        categoryModel = 'deepseek-chat';
      }
      // 移除 :free 等版本後綴，DeepSeek API 只接受 deepseek-chat 或 deepseek-reasoner
      categoryModel = categoryModel.replace(/:.*$/, '').replace(/-v[\d.]+/, '');
      console.log(`[Orchestrator] CategoryAgent model: ${agentConfig.meta_model} -> ${categoryModel}`);
      const categoryAgent = new CategoryAgent(categoryModel);
      const categoryOutput = await categoryAgent.generateCategories({
        title: metaOutput.seo.title,
        content: writingOutput.html || writingOutput.markdown || '',
        keywords: [input.title, ...strategyOutput.keywords.slice(0, 5)],
        outline: strategyOutput,
        language: input.region?.startsWith('zh') ? 'zh-TW' : 'en',
        existingCategories,
        existingTags,
      });
      result.category = categoryOutput;

      await this.updateJobStatus(input.articleJobId, 'processing', {
        current_phase: 'category_completed',
        category: categoryOutput,
      });

      // Phase 7: WordPress Direct Publish (如果配置了)
      if (wordpressConfig?.enabled) {
        try {
          const wordpressClient = new WordPressClient(wordpressConfig);
          const publishResult = await wordpressClient.publishArticle({
            title: metaOutput.seo.title,
            content: writingOutput.html || writingOutput.markdown || '',
            excerpt: metaOutput.seo.description,
            slug: metaOutput.slug,
            featuredImageUrl: imageOutput?.featuredImage?.url,
            categories: categoryOutput.categories.map(c => c.name),
            tags: categoryOutput.tags.map(t => t.name),
            seoTitle: metaOutput.seo.title,
            seoDescription: metaOutput.seo.description,
            focusKeyword: categoryOutput.focusKeywords[0] || input.title,
          }, workflowSettings.auto_publish ? 'publish' : 'draft');

          result.wordpress = {
            postId: publishResult.post.id,
            postUrl: publishResult.post.link,
            status: publishResult.post.status,
          };

          await this.updateJobStatus(input.articleJobId, 'processing', {
            current_phase: 'wordpress_published',
            wordpress: result.wordpress,
          });
        } catch (wpError) {
          console.error('[Orchestrator] WordPress 發布失敗:', wpError);
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

      const finalStatus = result.success ? 'completed' : 'failed';
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
              .from('article_jobs')
              .select('company_id')
              .eq('id', input.articleJobId)
              .single();

            if (jobData) {
              const { data: memberData } = await supabase
                .from('company_members')
                .select('user_id')
                .eq('company_id', jobData.company_id)
                .limit(1)
                .single();

              userId = memberData?.user_id;
            }
          }

          if (!userId) {
            throw new Error('無法取得有效的 user_id，文章儲存失敗');
          }

          // 在儲存文章前，先確保 article_job 記錄存在
          const { error: upsertError } = await supabase
            .from('article_jobs')
            .upsert({
              id: input.articleJobId,
              job_id: input.articleJobId,
              company_id: input.companyId,
              website_id: input.websiteId,
              user_id: userId,
              keywords: input.title ? [input.title] : [],
              status: 'processing',
              metadata: { message: '準備儲存文章到資料庫' },
            }, {
              onConflict: 'id',
            });

          if (upsertError) {
            console.error('[Orchestrator] 建立 job 記錄失敗:', upsertError);
            throw new Error(`建立 job 記錄失敗: ${upsertError.message}`);
          }
          console.log('[Orchestrator] Job 記錄已準備:', input.articleJobId);

          const savedArticle = await articleStorage.saveArticleWithRecommendations({
            articleJobId: input.articleJobId,
            result,
            websiteId: input.websiteId,
            companyId: input.companyId,
            userId,
          });

          console.log('[Orchestrator] 文章已儲存:', savedArticle.article.id);
          console.log('[Orchestrator] 推薦數量:', savedArticle.recommendations.length);

          // 更新 result 加入儲存資訊
          result.savedArticle = {
            id: savedArticle.article.id,
            recommendationsCount: savedArticle.recommendations.length,
          };
        } catch (storageError) {
          console.error('[Orchestrator] 文章儲存失敗:', storageError);
          // 不中斷流程，儲存失敗不影響文章生成
        }
      }

      return result;
    } catch (error) {
      result.errors = { orchestrator: error as Error };
      await this.updateJobStatus(input.articleJobId, 'failed', result);
      throw error;
    }
  }

  private async executeWritingAgent(
    strategyOutput: ArticleGenerationResult['strategy'],
    brandVoice: BrandVoice,
    previousArticles: PreviousArticle[],
    agentConfig: AgentConfig,
    aiConfig: AIClientConfig,
    context: AgentExecutionContext
  ) {
    if (!strategyOutput) throw new Error('Strategy output is required');

    const writingAgent = new WritingAgent(aiConfig, context);
    return writingAgent.execute({
      strategy: strategyOutput,
      brandVoice,
      previousArticles,
      model: agentConfig.writing_model,
      temperature: agentConfig.writing_temperature,
      maxTokens: agentConfig.writing_max_tokens,
    });
  }

  private async executeImageAgent(
    strategyOutput: ArticleGenerationResult['strategy'],
    agentConfig: AgentConfig,
    aiConfig: AIClientConfig,
    context: AgentExecutionContext
  ) {
    if (!strategyOutput) throw new Error('Strategy output is required');

    const imageAgent = new ImageAgent(aiConfig, context);
    return imageAgent.execute({
      title: strategyOutput.selectedTitle,
      outline: strategyOutput.outline,
      count: agentConfig.image_count,
      model: agentConfig.image_model,
      quality: 'standard' as const,
      size: agentConfig.image_size,
    });
  }

  private async executeContentGeneration(
    strategyOutput: ArticleGenerationResult['strategy'],
    imageOutput: ArticleGenerationResult['image'],
    brandVoice: BrandVoice,
    agentConfig: AgentConfig,
    aiConfig: AIClientConfig,
    context: AgentExecutionContext
  ) {
    if (!strategyOutput) throw new Error('Strategy output is required');

    const { outline, selectedTitle } = strategyOutput;

    const [introduction, conclusion, qa] = await Promise.all([
      this.executeWithRetry(
        async () => {
          const agent = new IntroductionAgent(aiConfig, context);
          return agent.execute({
            outline,
            featuredImage: imageOutput?.featuredImage || null,
            brandVoice,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
            maxTokens: 500,
          });
        },
        RetryConfigs.INTRODUCTION_AGENT
      ),
      this.executeWithRetry(
        async () => {
          const agent = new ConclusionAgent(aiConfig, context);
          return agent.execute({
            outline,
            brandVoice,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
            maxTokens: 400,
          });
        },
        RetryConfigs.CONCLUSION_AGENT
      ),
      this.executeWithRetry(
        async () => {
          const agent = new QAAgent(aiConfig, context);
          return agent.execute({
            title: selectedTitle,
            outline,
            brandVoice,
            count: 3,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
            maxTokens: 1000,
          });
        },
        RetryConfigs.QA_AGENT
      ),
    ]);

    const sections: SectionOutput[] = [];
    for (let i = 0; i < outline.mainSections.length; i++) {
      const section = outline.mainSections[i];
      const previousSummary: string | undefined = i > 0 ? sections[i - 1].summary : undefined;
      const sectionImage = imageOutput?.contentImages?.[i] || null;

      const sectionOutput = await this.executeWithRetry(
        async () => {
          const agent = new SectionAgent(aiConfig, context);
          return agent.execute({
            section,
            previousSummary,
            sectionImage,
            brandVoice,
            index: i,
            model: agentConfig.writing_model,
            temperature: agentConfig.writing_temperature,
            maxTokens: Math.floor(section.targetWordCount * 2),
          });
        },
        RetryConfigs.SECTION_AGENT
      );

      sections.push(sectionOutput);
    }

    const assembler = new ContentAssemblerAgent();
    const assembled = await assembler.execute({
      title: selectedTitle,
      introduction,
      sections,
      conclusion,
      qa,
    });

    // 計算統計資料
    const plainText = assembled.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const paragraphs = assembled.html.split(/<\/p>/gi).filter(p => p.trim().length > 0);

    const statistics = {
      wordCount: assembled.statistics.totalWords,
      paragraphCount: paragraphs.length,
      sentenceCount: sentences.length,
      readingTime: Math.ceil(assembled.statistics.totalWords / 200), // 假設每分鐘 200 字
      averageSentenceLength: sentences.length > 0 ? assembled.statistics.totalWords / sentences.length : 0,
    };

    // 執行資訊（合併所有 agent 的 token 使用量）
    const totalTokenUsage = {
      input:
        (introduction.executionInfo.tokenUsage?.input || 0) +
        (conclusion.executionInfo.tokenUsage?.input || 0) +
        (qa.executionInfo.tokenUsage?.input || 0) +
        sections.reduce((sum, s) => sum + (s.executionInfo.tokenUsage?.input || 0), 0),
      output:
        (introduction.executionInfo.tokenUsage?.output || 0) +
        (conclusion.executionInfo.tokenUsage?.output || 0) +
        (qa.executionInfo.tokenUsage?.output || 0) +
        sections.reduce((sum, s) => sum + (s.executionInfo.tokenUsage?.output || 0), 0),
    };

    const totalExecutionTime =
      (introduction.executionInfo.executionTime || 0) +
      (conclusion.executionInfo.executionTime || 0) +
      (qa.executionInfo.executionTime || 0) +
      sections.reduce((sum, s) => sum + (s.executionInfo.executionTime || 0), 0) +
      assembled.executionInfo.executionTime;

    return {
      markdown: assembled.markdown,
      html: assembled.html,
      statistics,
      internalLinks: [], // 內部連結會在 HTMLAgent 中處理
      keywordUsage: {
        count: 0,
        density: 0,
        distribution: [],
      }, // 關鍵字使用量可以在後續處理
      readability: {
        fleschKincaidGrade: 0,
        fleschReadingEase: 0,
        gunningFogIndex: 0,
      }, // 可讀性分數可以在後續處理
      executionInfo: {
        model: agentConfig.writing_model,
        executionTime: totalExecutionTime,
        tokenUsage: totalTokenUsage,
      },
    };
  }

  private async getBrandVoice(websiteId: string): Promise<BrandVoice> {
    const supabase = await this.getSupabase();
    const { data: brandVoices, error } = await supabase
      .from('brand_voices')
      .select('*')
      .eq('website_id', websiteId);

    if (error) {
      console.error('[Orchestrator] 查詢 brand_voices 失敗:', error);
      // 返回預設 brand voice
      return {
        id: '',
        website_id: websiteId,
        tone_of_voice: '專業、友善、易懂',
        target_audience: '一般網路使用者',
        keywords: [],
      };
    }

    const brandVoice = brandVoices?.[0];
    if (!brandVoice) {
      console.warn('[Orchestrator] website_id 沒有對應的 brand_voices，使用預設值');
      return {
        id: '',
        website_id: websiteId,
        tone_of_voice: '專業、友善、易懂',
        target_audience: '一般網路使用者',
        keywords: [],
      };
    }

    return brandVoice;
  }

  private async getWorkflowSettings(websiteId: string): Promise<WorkflowSettings> {
    const supabase = await this.getSupabase();
    const { data: workflowSettings, error } = await supabase
      .from('workflow_settings')
      .select('*')
      .eq('website_id', websiteId);

    if (error) {
      console.error('[Orchestrator] 查詢 workflow_settings 失敗:', error);
      // 返回預設 workflow settings
      return {
        id: '',
        website_id: websiteId,
        serp_analysis_enabled: true,
        competitor_count: 10,
        content_length_min: 1000,
        content_length_max: 3000,
        keyword_density_min: 1,
        keyword_density_max: 3,
        quality_threshold: 80,
        auto_publish: false,
        serp_model: 'perplexity-research',
        content_model: 'deepseek-chat',
        meta_model: 'deepseek-chat',
      };
    }

    const workflowSetting = workflowSettings?.[0];
    if (!workflowSetting) {
      console.warn('[Orchestrator] website_id 沒有對應的 workflow_settings，使用預設值');
      return {
        id: '',
        website_id: websiteId,
        serp_analysis_enabled: true,
        competitor_count: 10,
        content_length_min: 1000,
        content_length_max: 3000,
        keyword_density_min: 1,
        keyword_density_max: 3,
        quality_threshold: 80,
        auto_publish: false,
        serp_model: 'perplexity-research',
        content_model: 'deepseek-chat',
        meta_model: 'deepseek-chat',
      };
    }

    return workflowSetting;
  }

  private async getAgentConfig(websiteId: string): Promise<AgentConfig & {
    complexModel?: AIModel;
    simpleModel?: AIModel;
    imageModelInfo?: AIModel;
    researchModelInfo?: AIModel;
  }> {
    const supabase = await this.getSupabase();

    const { data: agentConfigs, error: configError } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('website_id', websiteId);

    let agentConfig = agentConfigs?.[0];

    if (configError) {
      console.error('[Orchestrator] 查詢 agent_configs 失敗:', configError);
      console.warn('[Orchestrator] 回滾到預設配置，並嘗試自動創建');

      try {
        await this.ensureAgentConfigExists(websiteId);
      } catch (autoCreateError) {
        console.error('[Orchestrator] 自動創建 agent_configs 失敗:', autoCreateError);
      }

      return this.getDefaultAgentConfig();
    }

    if (!agentConfig) {
      console.warn('[Orchestrator] website_id 沒有對應的 agent_configs，開始自動創建');

      try {
        const created = await this.ensureAgentConfigExists(websiteId);
        if (created) {
          agentConfig = created;
        } else {
          console.warn('[Orchestrator] 自動創建失敗，使用預設配置');
          return this.getDefaultAgentConfig();
        }
      } catch (autoCreateError) {
        console.error('[Orchestrator] 自動創建過程出錯:', autoCreateError);
        return this.getDefaultAgentConfig();
      }
    }

    const modelIds = [
      agentConfig.complex_processing_model,
      agentConfig.simple_processing_model,
      agentConfig.image_model,
      agentConfig.research_model,
    ].filter(Boolean);

    const { data: models, error: modelsError } = await supabase
      .from('ai_models')
      .select('*')
      .in('model_id', modelIds);

    if (modelsError) {
      console.error('[Orchestrator] 查詢 ai_models 失敗:', modelsError);
    }

    const modelsMap = new Map<string, AIModel>();
    (models || []).forEach((model: AIModel) => {
      modelsMap.set(model.model_id, model);
    });

    return {
      complex_processing_model: agentConfig.complex_processing_model,
      simple_processing_model: agentConfig.simple_processing_model,

      research_model: agentConfig.research_model || agentConfig.complex_processing_model || 'deepseek-reasoner',
      strategy_model: agentConfig.complex_processing_model || 'deepseek-reasoner',
      writing_model: agentConfig.simple_processing_model || 'deepseek-chat',
      image_model: agentConfig.image_model || 'gpt-image-1-mini',

      research_temperature: agentConfig.research_temperature || 0.7,
      strategy_temperature: agentConfig.strategy_temperature || 0.7,
      writing_temperature: agentConfig.writing_temperature || 0.7,
      research_max_tokens: agentConfig.research_max_tokens || 64000,
      strategy_max_tokens: agentConfig.strategy_max_tokens || 64000,
      writing_max_tokens: agentConfig.writing_max_tokens || 64000,

      image_size: agentConfig.image_size || '1024x1024',
      image_count: agentConfig.image_count || 3,

      meta_enabled: agentConfig.meta_enabled !== false,
      meta_model: agentConfig.meta_model || agentConfig.simple_processing_model || 'deepseek-chat',
      meta_temperature: agentConfig.meta_temperature || 0.7,
      meta_max_tokens: agentConfig.meta_max_tokens || 16000,

      complexModel: modelsMap.get(agentConfig.complex_processing_model),
      simpleModel: modelsMap.get(agentConfig.simple_processing_model),
      imageModelInfo: modelsMap.get(agentConfig.image_model),
      researchModelInfo: modelsMap.get(agentConfig.research_model),
    };
  }

  private async ensureAgentConfigExists(websiteId: string): Promise<any | null> {
    const supabase = await this.getSupabase();

    try {
      const { data: existing } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('website_id', websiteId)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log('[Orchestrator] agent_configs 已存在');
        return existing[0];
      }

      const defaultConfig = {
        website_id: websiteId,
        research_model: 'deepseek-reasoner',
        complex_processing_model: 'deepseek-reasoner',
        simple_processing_model: 'deepseek-chat',
        image_model: 'gpt-image-1-mini',
        research_temperature: 0.7,
        research_max_tokens: 16000,
        strategy_temperature: 0.7,
        strategy_max_tokens: 16000,
        writing_temperature: 0.7,
        writing_max_tokens: 16000,
        image_size: '1024x1024',
        image_count: 3,
        meta_enabled: true,
        meta_model: 'deepseek-chat',
        meta_temperature: 0.7,
        meta_max_tokens: 16000,
      };

      console.log('[Orchestrator] 正在為 website_id 創建 agent_configs:', websiteId);

      const { data: created, error: createError } = await supabase
        .from('agent_configs')
        .insert(defaultConfig)
        .select('*')
        .single();

      if (createError) {
        console.error('[Orchestrator] 創建 agent_configs 失敗:', createError);
        return null;
      }

      console.log('[Orchestrator] agent_configs 已成功創建:', websiteId);
      return created;
    } catch (error) {
      console.error('[Orchestrator] ensureAgentConfigExists 出錯:', error);
      return null;
    }
  }

  private async getPreviousArticles(websiteId: string): Promise<PreviousArticle[]> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('article_jobs')
      .select('id, keywords, generated_content')
      .eq('website_id', websiteId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return (data || []).map((article: any) => ({
      id: article.id,
      title: article.keywords?.[0] || 'Untitled',
      url: `/articles/${article.id}`,
      keywords: article.keywords || [],
      excerpt: (article.generated_content || '').substring(0, 200),
    }));
  }

  private getDefaultAgentConfig(): AgentConfig & {
    complexModel?: AIModel;
    simpleModel?: AIModel;
    imageModelInfo?: AIModel;
    researchModelInfo?: AIModel;
  } {
    return {
      complex_processing_model: 'deepseek-reasoner',
      simple_processing_model: 'deepseek-chat',
      research_model: 'deepseek-reasoner',
      strategy_model: 'deepseek-reasoner',
      writing_model: 'deepseek-chat',
      image_model: 'gpt-image-1-mini',
      research_temperature: 0.7,
      strategy_temperature: 0.7,
      writing_temperature: 0.7,
      research_max_tokens: 64000,
      strategy_max_tokens: 64000,
      writing_max_tokens: 64000,
      image_size: '1024x1024',
      image_count: 3,
      meta_enabled: true,
      meta_model: 'deepseek-chat',
      meta_temperature: 0.7,
      meta_max_tokens: 64000,
    };
  }

  private getAIConfig(): AIClientConfig {
    return {
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
    };
  }

  private async getWordPressConfig(websiteId: string): Promise<any> {
    const supabase = await this.getSupabase();
    const { data: configs, error } = await supabase
      .from('website_configs')
      .select('wordpress_url, wp_username, wp_app_password, wp_enabled, wordpress_access_token, wordpress_refresh_token')
      .eq('id', websiteId);

    if (error) {
      console.error('[Orchestrator] 查詢 website_configs 失敗:', error);
      return null;
    }

    const data = configs?.[0];
    if (!data?.wp_enabled) {
      return null;
    }

    // 確保配置格式正確
    if (!data.wordpress_url || (!data.wp_app_password && !data.wordpress_access_token)) {
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
    data: any
  ): Promise<void> {
    console.log(`[Orchestrator] 更新任務狀態: ${articleJobId.substring(0, 8)}... -> ${status}`);

    const supabase = await this.getSupabase();

    // 使用 update 只更新狀態和 metadata，不影響其他欄位
    const updateData: any = {
      status,
      metadata: data,
    };

    // 如果 data 包含 keywords，則更新 keywords
    if (data && typeof data === 'object' && 'keywords' in data) {
      updateData.keywords = data.keywords;
    }

    const { data: result, error } = await supabase
      .from('article_jobs')
      .update(updateData)
      .eq('id', articleJobId)
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
    contentImages: GeneratedImage[]
  ): string {
    let modifiedHtml = html;

    // 1. 在第一個 <p> 標籤之後插入精選圖片
    if (featuredImage) {
      const featuredImageHtml = `<figure class="wp-block-image size-large">
  <img src="${featuredImage.url}" alt="${featuredImage.altText}" width="${featuredImage.width}" height="${featuredImage.height}" />
  <figcaption>${featuredImage.altText}</figcaption>
</figure>\n\n`;

      const firstPTagIndex = modifiedHtml.indexOf('</p>');
      if (firstPTagIndex !== -1) {
        modifiedHtml =
          modifiedHtml.slice(0, firstPTagIndex + 4) +
          '\n\n' +
          featuredImageHtml +
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
        insertPositions = [...insertPositions, ...h3ToUse].sort((a, b) => a - b);
      }

      // 從後往前插入，避免位置偏移
      for (let i = Math.min(insertPositions.length, imageCount) - 1; i >= 0; i--) {
        const image = contentImages[i];
        const imageHtml = `\n\n<figure class="wp-block-image size-large">
  <img src="${image.url}" alt="${image.altText}" width="${image.width}" height="${image.height}" />
  <figcaption>${image.altText}</figcaption>
</figure>\n\n`;

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
    config: AgentRetryConfig
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = config.initialDelayMs;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const timeoutPromise = config.timeoutMs
          ? new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Agent execution timeout')), config.timeoutMs)
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

        this.errorTracker.trackError(config.agentName, error, attempt, config.maxAttempts);

        const isRetryable = this.isRetryableError(error, config.retryableErrors);
        const hasMoreAttempts = attempt < config.maxAttempts;

        if (!isRetryable || !hasMoreAttempts) {
          console.error(
            `[Orchestrator] ${config.agentName} failed after ${attempt} attempts`,
            { error: lastError.message }
          );
          throw lastError;
        }

        const currentDelay = Math.min(delay, config.maxDelayMs);
        console.warn(
          `[Orchestrator] ${config.agentName} attempt ${attempt} failed, retrying in ${currentDelay}ms`,
          { error: lastError.message }
        );

        await this.sleep(currentDelay);
        delay *= config.backoffMultiplier;
      }
    }

    throw lastError || new Error(`${config.agentName} failed after ${config.maxAttempts} attempts`);
  }

  private isRetryableError(error: unknown, retryableErrors: readonly string[]): boolean {
    const err = error as Error & { code?: string; type?: string };

    if (err.code && retryableErrors.includes(err.code)) {
      return true;
    }

    const message = err.message.toLowerCase();
    for (const retryableType of retryableErrors) {
      if (message.includes(retryableType.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private shouldUseMultiAgent(input: ArticleGenerationInput): boolean {
    const enabled = process.env.USE_MULTI_AGENT_ARCHITECTURE === 'true';
    if (!enabled) {
      return false;
    }

    const rolloutPercentage = parseInt(process.env.MULTI_AGENT_ROLLOUT_PERCENTAGE || '100', 10);

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
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}
