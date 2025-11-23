import { createClient } from '@supabase/supabase-js';
import { OpenAIModelSync } from './openai-sync';
import { AnthropicModelSync } from './anthropic-sync';

export interface SyncResult {
  provider: string;
  newModels: number;
  updatedModels: number;
  errors: string[];
}

export class ModelSyncService {
  private supabase;
  private openaiSync: OpenAIModelSync;
  private anthropicSync: AnthropicModelSync;

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    openaiApiKey: string
  ) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.openaiSync = new OpenAIModelSync(openaiApiKey);
    this.anthropicSync = new AnthropicModelSync();
  }

  async syncAllProviders(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    results.push(await this.syncOpenAI());
    results.push(await this.syncAnthropic());

    return results;
  }

  async syncOpenAI(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'openai',
      newModels: 0,
      updatedModels: 0,
      errors: [],
    };

    try {
      const models = await this.openaiSync.fetchAvailableModels();

      for (const model of models) {
        try {
          const { data: existing } = await this.supabase
            .from('ai_models')
            .select('id')
            .eq('provider', 'openai')
            .eq('model_id', model.modelId)
            .single();

          if (existing) {
            await this.supabase
              .from('ai_models')
              .update({
                model_name: model.modelName,
                description: model.description,
                capabilities: model.capabilities,
                pricing: model.pricing,
                context_window: model.contextWindow,
                max_tokens: model.maxTokens,
                supports_streaming: model.supportsStreaming,
                supports_json_mode: model.supportsJsonMode,
                supports_function_calling: model.supportsFunctionCalling,
                image_sizes: model.imageSizes,
                image_quality_options: model.imageQualityOptions,
                tags: model.tags,
                version: model.version,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            result.updatedModels++;
          } else {
            await this.supabase.from('ai_models').insert({
              provider: model.provider,
              model_id: model.modelId,
              model_name: model.modelName,
              model_type: model.modelType,
              description: model.description,
              capabilities: model.capabilities,
              pricing: model.pricing,
              context_window: model.contextWindow,
              max_tokens: model.maxTokens,
              supports_streaming: model.supportsStreaming,
              supports_json_mode: model.supportsJsonMode,
              supports_function_calling: model.supportsFunctionCalling,
              image_sizes: model.imageSizes,
              image_quality_options: model.imageQualityOptions,
              is_active: true,
              is_deprecated: false,
              tags: model.tags,
              version: model.version,
            });

            result.newModels++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to sync ${model.modelId}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Failed to fetch OpenAI models: ${error.message}`);
    }

    return result;
  }

  async syncAnthropic(): Promise<SyncResult> {
    const result: SyncResult = {
      provider: 'anthropic',
      newModels: 0,
      updatedModels: 0,
      errors: [],
    };

    try {
      const models = await this.anthropicSync.fetchAvailableModels();
      const newModels = await this.anthropicSync.checkForNewModels();

      for (const model of [...models, ...newModels]) {
        try {
          const { data: existing } = await this.supabase
            .from('ai_models')
            .select('id')
            .eq('provider', 'anthropic')
            .eq('model_id', model.modelId)
            .single();

          if (existing) {
            await this.supabase
              .from('ai_models')
              .update({
                model_name: model.modelName,
                description: model.description,
                capabilities: model.capabilities,
                pricing: model.pricing,
                context_window: model.contextWindow,
                max_tokens: model.maxTokens,
                supports_streaming: model.supportsStreaming,
                tags: model.tags,
                version: model.version,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existing.id);

            result.updatedModels++;
          } else {
            await this.supabase.from('ai_models').insert({
              provider: model.provider,
              model_id: model.modelId,
              model_name: model.modelName,
              model_type: model.modelType,
              description: model.description,
              capabilities: model.capabilities,
              pricing: model.pricing,
              context_window: model.contextWindow,
              max_tokens: model.maxTokens,
              supports_streaming: model.supportsStreaming,
              is_active: true,
              is_deprecated: false,
              tags: model.tags,
              version: model.version,
            });

            result.newModels++;
          }
        } catch (error: any) {
          result.errors.push(`Failed to sync ${model.modelId}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Failed to fetch Anthropic models: ${error.message}`);
    }

    return result;
  }

  async markDeprecatedModels(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 6);

    const { data: oldModels } = await this.supabase
      .from('ai_models')
      .select('id, model_id')
      .lt('created_at', cutoffDate.toISOString())
      .eq('is_deprecated', false);

    if (!oldModels || oldModels.length === 0) {
      return 0;
    }

    const modelsToCheck = oldModels.filter(
      (m) =>
        m.model_id.includes('preview') ||
        m.model_id.match(/\d{4}/) ||
        m.model_id.includes('0613')
    );

    for (const model of modelsToCheck) {
      await this.supabase
        .from('ai_models')
        .update({
          is_deprecated: true,
          deprecated_at: new Date().toISOString(),
          tags: ['deprecated'],
        })
        .eq('id', model.id);
    }

    return modelsToCheck.length;
  }
}
