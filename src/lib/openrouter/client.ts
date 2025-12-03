/**
 * OpenRouter API Client
 *
 * 通過 Cloudflare AI Gateway 調用 OpenRouter API
 * 使用 OpenAI 相容 API 格式
 */

import {
  getOpenRouterBaseUrl,
  buildOpenRouterHeaders,
} from "@/lib/cloudflare/ai-gateway";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterCompletionOptions {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  stream?: boolean;
  response_format?: {
    type: "text" | "json_object";
  };
}

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenRouterChoice {
  index: number;
  message: {
    role: "assistant";
    content: string;
  };
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface OpenRouterCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenRouterChoice[];
  usage: OpenRouterUsage;
}

export interface OpenRouterError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface OpenRouterClientConfig {
  apiKey?: string;
  timeout?: number;
  maxRetries?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: OpenRouterClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || "";
    this.baseURL = getOpenRouterBaseUrl();
    this.timeout = config.timeout || 120000;
    this.maxRetries = config.maxRetries || 3;
    this.defaultTemperature = config.defaultTemperature || 0.7;
    this.defaultMaxTokens = config.defaultMaxTokens || 16000;
  }

  /**
   * 檢查是否可以使用 OpenRouter
   * Gateway 模式下不需要 API Key（使用存儲的 key）
   * 直連模式下需要 API Key
   */
  isConfigured(): boolean {
    // Gateway 模式：只要 Gateway 啟用就可以使用（BYOK 模式）
    if (this.baseURL.includes("gateway.ai.cloudflare.com")) {
      return true;
    }
    // 直連模式：需要 API Key
    return !!this.apiKey;
  }

  async chat(
    options: OpenRouterCompletionOptions,
  ): Promise<OpenRouterCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error("OpenRouter API Key 未設定");
    }

    const requestBody = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? this.defaultTemperature,
      max_tokens: options.max_tokens ?? this.defaultMaxTokens,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      stop: options.stop,
      stream: options.stream ?? false,
      response_format: options.response_format,
    };

    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key as keyof typeof requestBody] === undefined) {
        delete requestBody[key as keyof typeof requestBody];
      }
    });

    return this.makeRequest("/chat/completions", requestBody);
  }

  async complete(params: {
    model: string;
    prompt: string | OpenRouterMessage[];
    temperature?: number;
    max_tokens?: number;
    responseFormat?: "text" | "json";
  }): Promise<{
    content: string;
    usage: OpenRouterUsage;
    model: string;
  }> {
    const messages =
      typeof params.prompt === "string"
        ? [{ role: "user" as const, content: params.prompt }]
        : params.prompt;

    const response = await this.chat({
      model: params.model,
      messages,
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      response_format:
        params.responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    return {
      content: response.choices[0]?.message.content || "",
      usage: response.usage,
      model: response.model,
    };
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<OpenRouterCompletionResponse> {
    const url = `${this.baseURL}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: "POST",
          headers: buildOpenRouterHeaders(this.apiKey),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = (await response.json()) as OpenRouterError;
          const error = new Error(
            `OpenRouter API Error [${response.status}]: ${errorData.error?.message || response.statusText}`,
          );

          if (response.status === 429) {
            if (attempt < this.maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
              console.log(
                `[OpenRouterClient] Rate limit，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
              );
              await this.sleep(delay);
              continue;
            }
          }

          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = 2000 * attempt;
            console.log(
              `[OpenRouterClient] 伺服器錯誤，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
            );
            await this.sleep(delay);
            continue;
          }

          throw error;
        }

        const data = (await response.json()) as OpenRouterCompletionResponse;

        if (attempt > 1) {
          console.log(`[OpenRouterClient] 重試成功 (第 ${attempt} 次嘗試)`);
        }

        return data;
      } catch (error: unknown) {
        lastError = error as Error;

        if (error instanceof Error && error.name === "AbortError") {
          console.log(`[OpenRouterClient] 請求超時 (${this.timeout}ms)`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.log(`[OpenRouterClient] 網路錯誤: ${error.message}`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error(
      `OpenRouter API 請求失敗（已重試 ${this.maxRetries} 次）: ${lastError?.message || "Unknown error"}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let globalClient: OpenRouterClient | null = null;

export function getOpenRouterClient(
  config?: OpenRouterClientConfig,
): OpenRouterClient {
  if (!globalClient) {
    globalClient = new OpenRouterClient(config);
  }
  return globalClient;
}

export function resetOpenRouterClient(): void {
  globalClient = null;
}

export default OpenRouterClient;
