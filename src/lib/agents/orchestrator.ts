import { createClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { ArticleStorageService } from '@/lib/services/article-storage';
import { ResearchAgent } from './research-agent';
import { StrategyAgent } from './strategy-agent';
import { WritingAgent } from './writing-agent';
import { ImageAgent } from './image-agent';
import { QualityAgent } from './quality-agent';
import { MetaAgent } from './meta-agent';
import { HTMLAgent } from './html-agent';
import { CategoryAgent } from './category-agent';
import { WordPressClient } from '@/lib/wordpress/client';
import { PerplexityClient } from '@/lib/perplexity/client';
import type {
  ArticleGenerationInput,
  ArticleGenerationResult,
  BrandVoice,
  WorkflowSettings,
  AgentConfig,
  PreviousArticle,
  AIClientConfig,
} from '@/types/agents';
import { AgentExecutionContext } from './base-agent';

export class ParallelOrchestrator {
  private supabaseClient?: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabaseClient = supabaseClient;
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
      qualityCheck: 0,
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

      const phase1Start = Date.now();
      const researchAgent = new ResearchAgent(aiConfig, context);
      const researchOutput = await researchAgent.execute({
        keyword: input.keyword,
        region: input.region,
        competitorCount: workflowSettings.competitor_count,
        model: agentConfig.research_model,
        temperature: agentConfig.research_temperature,
        maxTokens: agentConfig.research_max_tokens,
      });
      phaseTimings.research = Date.now() - phase1Start;
      result.research = researchOutput;

      await this.updateJobStatus(input.articleJobId, 'research_completed', {
        research: researchOutput,
      });

      const phase2Start = Date.now();
      const strategyAgent = new StrategyAgent(aiConfig, context);
      const strategyOutput = await strategyAgent.execute({
        researchData: researchOutput,
        brandVoice,
        targetWordCount: workflowSettings.content_length_min,
        model: agentConfig.strategy_model,
        temperature: agentConfig.strategy_temperature,
        maxTokens: agentConfig.strategy_max_tokens,
      });
      phaseTimings.strategy = Date.now() - phase2Start;
      result.strategy = strategyOutput;

      await this.updateJobStatus(input.articleJobId, 'strategy_completed', {
        strategy: strategyOutput,
      });

      const phase3Start = Date.now();
      const [writingOutput, imageOutput] = await Promise.all([
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
      phaseTimings.contentGeneration = Date.now() - phase3Start;
      result.writing = writingOutput;
      result.image = imageOutput;

      await this.updateJobStatus(input.articleJobId, 'content_completed', {
        writing: writingOutput,
        image: imageOutput,
      });

      const phase4Start = Date.now();
      const metaAgent = new MetaAgent(aiConfig, context);
      const metaOutput = await metaAgent.execute({
        content: writingOutput,
        keyword: input.keyword,
        titleOptions: strategyOutput.titleOptions,
        model: agentConfig.meta_model,
        temperature: agentConfig.meta_temperature,
        maxTokens: agentConfig.meta_max_tokens,
      });
      phaseTimings.metaGeneration = Date.now() - phase4Start;
      result.meta = metaOutput;

      if (imageOutput?.featuredImage) {
        metaOutput.openGraph.image = imageOutput.featuredImage.url;
        metaOutput.twitterCard.image = imageOutput.featuredImage.url;
      }

      await this.updateJobStatus(input.articleJobId, 'meta_completed', {
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

      await this.updateJobStatus(input.articleJobId, 'html_completed', {
        html: htmlOutput,
      });

      const phase5Start = Date.now();
      const qualityAgent = new QualityAgent(aiConfig, context);
      const qualityOutput = await qualityAgent.execute({
        content: writingOutput,
        images: imageOutput,
        meta: metaOutput,
        thresholds: {
          quality_threshold: workflowSettings.quality_threshold,
          content_length_min: workflowSettings.content_length_min,
          content_length_max: workflowSettings.content_length_max,
          keyword_density_min: workflowSettings.keyword_density_min,
          keyword_density_max: workflowSettings.keyword_density_max,
        },
      });
      phaseTimings.qualityCheck = Date.now() - phase5Start;
      result.quality = qualityOutput;

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

      // CategoryAgent 使用 DeepSeek 自己的 API，需要移除 OpenRouter 前綴和版本後綴
      let categoryModel = agentConfig.meta_model.replace('deepseek/', '');
      // 移除 :free 等版本後綴，DeepSeek API 只接受 deepseek-chat 或 deepseek-reasoner
      categoryModel = categoryModel.replace(/:.*$/, '').replace(/-v[\d.]+/, '');
      console.log(`[Orchestrator] CategoryAgent model: ${agentConfig.meta_model} -> ${categoryModel}`);
      const categoryAgent = new CategoryAgent(categoryModel);
      const categoryOutput = await categoryAgent.generateCategories({
        title: metaOutput.seo.title,
        content: writingOutput.html || writingOutput.markdown || '',
        keywords: [input.keyword, ...strategyOutput.keywords.slice(0, 5)],
        outline: strategyOutput,
        language: input.region?.startsWith('zh') ? 'zh-TW' : 'en',
        existingCategories,
        existingTags,
      });
      result.category = categoryOutput;

      await this.updateJobStatus(input.articleJobId, 'category_completed', {
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
            focusKeyword: categoryOutput.focusKeywords[0] || input.keyword,
          }, workflowSettings.auto_publish ? 'publish' : 'draft');

          result.wordpress = {
            postId: publishResult.post.id,
            postUrl: publishResult.post.link,
            status: publishResult.post.status,
          };

          await this.updateJobStatus(input.articleJobId, 'wordpress_published', {
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
        phaseTimings.metaGeneration +
        phaseTimings.qualityCheck;
      const parallelSpeedup = serialTime / totalTime;

      result.success = qualityOutput.passed;
      result.executionStats = {
        totalTime,
        phases: phaseTimings,
        parallelSpeedup,
      };

      const finalStatus = qualityOutput.passed ? 'completed' : 'quality_failed';
      await this.updateJobStatus(input.articleJobId, finalStatus, result);

      // Phase 8: 儲存文章到資料庫（如果品質通過或已發布到 WordPress）
      if (qualityOutput.passed || result.wordpress) {
        try {
          const articleStorage = new ArticleStorageService(supabase);

          // 取得 user ID，如果沒有認證則使用預設測試 UUID
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData.user?.id || '00000000-0000-0000-0000-000000000000';

          // 在儲存文章前，先確保 article_job 記錄存在
          const { error: upsertError } = await supabase
            .from('article_jobs')
            .upsert({
              id: input.articleJobId,
              keywords: input.researchKeyword || '',
              status: 'storage_preparing',
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

  private async getBrandVoice(websiteId: string): Promise<BrandVoice> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('brand_voices')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getWorkflowSettings(websiteId: string): Promise<WorkflowSettings> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('workflow_settings')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getAgentConfig(websiteId: string): Promise<AgentConfig> {
    const supabase = await this.getSupabase();

    const { data: website, error: websiteError } = await supabase
      .from('website_configs')
      .select('company_id')
      .eq('id', websiteId)
      .single();

    if (websiteError) throw websiteError;

    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('ai_model_preferences')
      .eq('id', website.company_id)
      .single();

    if (companyError) throw companyError;

    const preferences = company.ai_model_preferences || {};

    // Research: 使用思考模式 (reasoner) 進行深度分析
    const researchModel = preferences.research_model || 'deepseek/deepseek-reasoner';

    // Strategy: 使用 chat 模式（reasoner 不支援 JSON 格式）
    const strategyModel = preferences.strategy_model || 'deepseek/deepseek-chat';

    // Writing/Meta/Category: 使用非思考模式 (chat) 保持流暢性
    const writingModel = preferences.writing_model || 'deepseek/deepseek-chat';
    const cheapModel = preferences.meta_model || 'deepseek/deepseek-chat';

    return {
      research_model: researchModel,
      strategy_model: strategyModel,
      writing_model: writingModel,
      image_model: preferences.image_model || 'none',
      research_temperature: 0.3,
      strategy_temperature: 0.7,
      writing_temperature: 0.7,
      research_max_tokens: 4000,
      strategy_max_tokens: 4000,
      writing_max_tokens: 8000,
      image_size: '1024x1024',
      image_count: 3,
      meta_enabled: true,
      meta_model: cheapModel,
      meta_temperature: 0.7,
      meta_max_tokens: 2000,
    };
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

  private getAIConfig(): AIClientConfig {
    return {
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
    };
  }

  private async getWordPressConfig(websiteId: string): Promise<any> {
    const supabase = await this.getSupabase();
    const { data, error } = await supabase
      .from('website_configs')
      .select('wordpress_url, wp_username, wp_app_password, wp_enabled, wordpress_access_token, wordpress_refresh_token')
      .eq('id', websiteId)
      .single();

    if (error || !data?.wp_enabled) {
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
    const supabase = await this.getSupabase();

    // 使用 upsert 確保 job 記錄存在
    //只在初始建立時需要 keywords
    const jobData: any = {
      id: articleJobId,
      status,
      metadata: data,
    };

    // 如果 data 包含 keywords，則加入
    if (data && typeof data === 'object' && 'keywords' in data) {
      jobData.keywords = data.keywords;
    }

    await supabase
      .from('article_jobs')
      .upsert(jobData, {
        onConflict: 'id',
      });
  }
}
