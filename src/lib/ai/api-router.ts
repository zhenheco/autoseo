/**
 * AI API Router
 * 根據模型的 api_provider 選擇正確的 API 客戶端
 */

import { getDeepSeekClient } from "@/lib/deepseek/client";
import { getOpenAIImageClient } from "@/lib/openai/image-client";
import { getOpenAITextClient } from "@/lib/openai/text-client";
import { getOpenRouterClient } from "@/lib/openrouter/client";
import { getPerplexityClient } from "@/lib/perplexity/client";
import {
  detectAIProvider,
  getFallbackChain,
  getNextFallbackModel,
  isRetryableProviderError,
} from "@/lib/ai/fallback-policy";
import {
  DEFAULT_FALLBACK_CHAINS,
  type APIProvider,
  type UnifiedAPIResponse,
} from "@/types/ai-models";
import type { AIMessage } from "@/types/agents";

export interface APIRouterConfig {
  deepseekApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
  perplexityApiKey?: string;
  maxRetries?: number;
  timeout?: number;
  enableFallback?: boolean;
}

export interface TextCompletionOptions {
  model: string;
  apiProvider: APIProvider;
  prompt: string | AIMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface ImageGenerationOptions {
  model: string;
  apiProvider: APIProvider;
  prompt: string;
  size?: string;
  quality?: "standard" | "hd";
  count?: number;
}

/**
 * AI API Router - 統一的 API 路由器
 */
export class APIRouter {
  private config: APIRouterConfig;
  private fallbackChains: Record<string, string[]>;

  constructor(config: APIRouterConfig = {}) {
    this.config = config;
    this.fallbackChains = DEFAULT_FALLBACK_CHAINS;
  }

  /**
   * 文字完成（根據 api_provider 路由）
   */
  async complete(options: TextCompletionOptions): Promise<UnifiedAPIResponse> {
    const messages =
      typeof options.prompt === "string"
        ? [{ role: "user" as const, content: options.prompt }]
        : options.prompt;

    let lastError: Error | null = null;
    const enableFallback = this.config.enableFallback !== false;
    const maxAttempts = enableFallback ? 3 : 1;

    const fallbackChain = getFallbackChain(options.model, this.fallbackChains);
    let currentModel = options.model;
    let currentProvider = options.apiProvider;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.routeTextRequest(
          currentModel,
          currentProvider,
          messages,
          options.temperature,
          options.maxTokens,
          options.responseFormat,
        );

        // 如果使用了 fallback，記錄日誌
        if (attempt > 1) {
          console.log(
            `[APIRouter] ✅ Fallback 成功: ${currentModel} (原: ${options.model}, 嘗試: ${attempt})`,
          );
        }

        return result;
      } catch (error: unknown) {
        lastError = error as Error;
        const errorMessage = (error as Error).message || "";

        // Rate limit 或服務器錯誤，嘗試 fallback
        if (
          isRetryableProviderError(error) &&
          enableFallback &&
          attempt < maxAttempts
        ) {
          const nextModel = getNextFallbackModel(currentModel, fallbackChain);

          if (nextModel) {
            console.log(
              `[APIRouter] ⚠️ ${currentModel} 失敗 (${errorMessage})`,
            );
            console.log(`[APIRouter] 🔄 切換到 Fallback: ${nextModel}`);

            currentModel = nextModel;
            currentProvider = detectAIProvider(nextModel);
            continue;
          }
        }

        // 其他錯誤或無 fallback 可用
        if (attempt < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          console.log(
            `[APIRouter] ⏳ 重試中... (${delay}ms 後第 ${attempt + 1} 次)`,
          );
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `API 請求失敗（已重試 ${maxAttempts} 次）: ${lastError?.message || "Unknown error"}`,
    );
  }

  /**
   * 圖片生成
   */
  async generateImage(options: ImageGenerationOptions): Promise<{
    url: string;
    revisedPrompt?: string;
  }> {
    if (options.apiProvider !== "openai") {
      throw new Error(
        `圖片生成目前只支援 OpenAI API，收到: ${options.apiProvider}`,
      );
    }

    const client = getOpenAIImageClient({
      apiKey: this.config.openaiApiKey,
    });

    return client.generateImage({
      model: options.model,
      prompt: options.prompt,
      size: options.size,
      quality: options.quality,
    });
  }

  /**
   * 批量圖片生成
   */
  async generateImages(
    options: ImageGenerationOptions & { count: number },
  ): Promise<
    Array<{
      url: string;
      revisedPrompt?: string;
    }>
  > {
    if (options.apiProvider !== "openai") {
      throw new Error(
        `圖片生成目前只支援 OpenAI API，收到: ${options.apiProvider}`,
      );
    }

    const client = getOpenAIImageClient({
      apiKey: this.config.openaiApiKey,
    });

    return client.generateMultiple({
      model: options.model,
      prompt: options.prompt,
      count: options.count,
      size: options.size,
      quality: options.quality,
    });
  }

  /**
   * 路由文字請求到正確的 API
   */
  private async routeTextRequest(
    model: string,
    apiProvider: APIProvider,
    messages: AIMessage[],
    temperature?: number,
    maxTokens?: number,
    responseFormat?: "text" | "json",
  ): Promise<UnifiedAPIResponse> {
    switch (apiProvider) {
      case "deepseek":
        return this.callDeepSeekAPI(
          model,
          messages,
          temperature,
          maxTokens,
          responseFormat,
        );

      case "openai":
        return this.callOpenAIAPI(
          model,
          messages,
          temperature,
          maxTokens,
          responseFormat,
        );

      case "perplexity":
        return this.callPerplexityAPI(model, messages, temperature, maxTokens);

      case "openrouter":
        return this.callOpenRouterAPI(
          model,
          messages,
          temperature,
          maxTokens,
          responseFormat,
        );

      default:
        throw new Error(`不支援的 API Provider: ${apiProvider}`);
    }
  }

  /**
   * 呼叫 DeepSeek 官方 API
   */
  private async callDeepSeekAPI(
    model: string,
    messages: AIMessage[],
    temperature?: number,
    maxTokens?: number,
    responseFormat?: "text" | "json",
  ): Promise<UnifiedAPIResponse> {
    const client = getDeepSeekClient({
      apiKey: this.config.deepseekApiKey,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });

    // DeepSeek 只接受 deepseek-reasoner 或 deepseek-chat
    const deepseekModel = model.includes("reasoner")
      ? "deepseek-reasoner"
      : "deepseek-chat";

    const result = await client.complete({
      model: deepseekModel as "deepseek-reasoner" | "deepseek-chat",
      prompt: messages,
      temperature,
      max_tokens: maxTokens,
      responseFormat,
    });

    return {
      content: result.content,
      usage: {
        input_tokens: result.usage.prompt_tokens,
        output_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        billing_input_tokens: result.usage.prompt_tokens * 2,
        billing_output_tokens: result.usage.completion_tokens * 2,
        total_billing_tokens: result.usage.total_tokens * 2,
      },
      model: result.model,
      api_provider: "deepseek",
    };
  }

  /**
   * 呼叫 OpenAI 官方 API
   */
  private async callOpenAIAPI(
    model: string,
    messages: AIMessage[],
    temperature?: number,
    maxTokens?: number,
    responseFormat?: "text" | "json",
  ): Promise<UnifiedAPIResponse> {
    const client = getOpenAITextClient({
      apiKey: this.config.openaiApiKey,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });

    const result = await client.complete({
      model: model.replace("openai/", ""),
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format:
        responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    return {
      content: result.content,
      usage: {
        input_tokens: result.usage.prompt_tokens,
        output_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        billing_input_tokens: result.usage.prompt_tokens,
        billing_output_tokens: result.usage.completion_tokens,
        total_billing_tokens: result.usage.total_tokens,
      },
      model: result.model,
      api_provider: "openai",
    };
  }

  /**
   * 呼叫 Perplexity API
   */
  private async callPerplexityAPI(
    model: string,
    messages: AIMessage[],
    temperature?: number,
    maxTokens?: number,
  ): Promise<UnifiedAPIResponse> {
    const client = getPerplexityClient();

    const query = messages.map((m) => m.content).join("\n");

    const result = await client.search(query, {
      model,
      temperature,
      max_tokens: maxTokens,
    });

    return {
      content: result.content,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        billing_input_tokens: 0,
        billing_output_tokens: 0,
        total_billing_tokens: 0,
      },
      model: model,
      api_provider: "perplexity",
    };
  }

  /**
   * 呼叫 OpenRouter API
   */
  private async callOpenRouterAPI(
    model: string,
    messages: AIMessage[],
    temperature?: number,
    maxTokens?: number,
    responseFormat?: "text" | "json",
  ): Promise<UnifiedAPIResponse> {
    const client = getOpenRouterClient({
      apiKey: this.config.openrouterApiKey,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });

    const result = await client.complete({
      model,
      prompt: messages,
      temperature,
      max_tokens: maxTokens,
      responseFormat,
    });

    return {
      content: result.content,
      usage: {
        input_tokens: result.usage.prompt_tokens,
        output_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        billing_input_tokens: 0,
        billing_output_tokens: 0,
        total_billing_tokens: 0,
      },
      model: result.model,
      api_provider: "openrouter",
    };
  }

  /**
   * Sleep 工具函數
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * 全域 API Router 實例（單例模式）
 */
let globalRouter: APIRouter | null = null;

export function getAPIRouter(config?: APIRouterConfig): APIRouter {
  if (!globalRouter) {
    globalRouter = new APIRouter({
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY,
      openrouterApiKey: process.env.OPENROUTER_API_KEY,
      perplexityApiKey: process.env.PERPLEXITY_API_KEY,
      maxRetries: 3,
      timeout: 120000,
      enableFallback: true,
      ...config,
    });
  }
  return globalRouter;
}

/**
 * 重置全域 Router（主要用於測試）
 */
export function resetAPIRouter(): void {
  globalRouter = null;
}

/**
 * 偵測模型的 API Provider（獨立函數版本）
 */
export function detectAPIProvider(model: string): APIProvider {
  return detectAIProvider(model);
}

// 預設導出
export default APIRouter;
