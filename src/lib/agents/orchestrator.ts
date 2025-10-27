import { createClient } from '@/lib/supabase/server';
import { ResearchAgent } from './research-agent';
import { StrategyAgent } from './strategy-agent';
import { WritingAgent } from './writing-agent';
import { ImageAgent } from './image-agent';
import { QualityAgent } from './quality-agent';
import { MetaAgent } from './meta-agent';
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
  async execute(input: ArticleGenerationInput): Promise<ArticleGenerationResult> {
    const supabase = await createClient();
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

      if (imageOutput.featuredImage) {
        metaOutput.openGraph.image = imageOutput.featuredImage.url;
        metaOutput.twitterCard.image = imageOutput.featuredImage.url;
      }

      await this.updateJobStatus(input.articleJobId, 'meta_completed', {
        meta: metaOutput,
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
      quality: agentConfig.image_quality,
      size: agentConfig.image_size,
    });
  }

  private async getBrandVoice(websiteId: string): Promise<BrandVoice> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('brand_voices')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getWorkflowSettings(websiteId: string): Promise<WorkflowSettings> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('workflow_settings')
      .select('*')
      .eq('website_id', websiteId)
      .single();

    if (error) throw error;
    return data;
  }

  private async getAgentConfig(websiteId: string): Promise<AgentConfig> {
    const supabase = await createClient();

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

    const preferences = company.ai_model_preferences || {
      text_model: 'anthropic/claude-3.5-sonnet',
      image_model: 'openai/dall-e-3',
      fallback_text_model: 'openai/gpt-4o',
      fallback_image_model: 'openai/dall-e-2',
    };

    return {
      research_model: preferences.text_model,
      strategy_model: preferences.text_model,
      writing_model: preferences.text_model,
      image_model: preferences.image_model,
      research_temperature: 0.3,
      strategy_temperature: 0.7,
      writing_temperature: 0.7,
      research_max_tokens: 4000,
      strategy_max_tokens: 4000,
      writing_max_tokens: 8000,
      image_size: '1024x1024',
      image_count: 3,
      meta_enabled: true,
      meta_model: preferences.text_model,
      meta_temperature: 0.7,
      meta_max_tokens: 2000,
    };
  }

  private async getPreviousArticles(websiteId: string): Promise<PreviousArticle[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('article_jobs')
      .select('id, title, keywords, excerpt')
      .eq('website_id', websiteId)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return (data || []).map((article: any) => ({
      id: article.id,
      title: article.title || '',
      url: `/articles/${article.id}`,
      keywords: article.keywords || [],
      excerpt: article.excerpt || '',
    }));
  }

  private getAIConfig(): AIClientConfig {
    return {
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
    };
  }

  private async updateJobStatus(
    articleJobId: string,
    status: string,
    data: any
  ): Promise<void> {
    const supabase = await createClient();
    await supabase
      .from('article_jobs')
      .update({
        status,
        updated_at: new Date().toISOString(),
        metadata: data,
      })
      .eq('id', articleJobId);
  }
}
