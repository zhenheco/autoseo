/**
 * OpenAI Official Text API Client
 *
 * 支援 OpenAI 官方文字生成 API (Chat Completions)
 * API 文件: https://platform.openai.com/docs/api-reference/chat
 */

import type { AIMessage } from "@/types/agents";
import {
  getOpenAIBaseUrl,
  getGatewayHeaders,
  isGatewayEnabled,
} from "@shared/ai-gateway";

export interface OpenAITextCompletionOptions {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "text" | "json_object" };
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  user?: string;
}

export interface OpenAITextResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAITextClientConfig {
  apiKey?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
}

export class OpenAITextClient {
  private apiKey: string;
  private organization?: string;
  private timeout: number;
  private maxRetries: number;

  private get baseURL(): string {
    return getOpenAIBaseUrl();
  }

  constructor(config: OpenAITextClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.organization = config.organization || process.env.OPENAI_ORGANIZATION;
    this.timeout = config.timeout || 120000;
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      console.warn(
        "[OpenAITextClient] ⚠️ API Key 未設定，請設定 OPENAI_API_KEY 環境變數",
      );
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async complete(options: OpenAITextCompletionOptions): Promise<{
    content: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error("OpenAI API Key 未設定");
    }

    const requestBody: Record<string, unknown> = {
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens,
      top_p: options.top_p,
      frequency_penalty: options.frequency_penalty,
      presence_penalty: options.presence_penalty,
      user: options.user,
    };

    if (options.response_format) {
      requestBody.response_format = options.response_format;
    }

    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key] === undefined) {
        delete requestBody[key];
      }
    });

    const response = await this.makeRequest("/chat/completions", requestBody);

    return {
      content: response.choices[0]?.message?.content || "",
      usage: response.usage,
      model: response.model,
    };
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<OpenAITextResponse> {
    const url = `${this.baseURL}${endpoint}`;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const headers: Record<string, string> = {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        };

        if (this.organization) {
          headers["OpenAI-Organization"] = this.organization;
        }

        if (isGatewayEnabled()) {
          Object.assign(headers, getGatewayHeaders());
        }

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = (await response.json()) as {
            error?: { message?: string };
          };
          const error = new Error(
            `OpenAI Text API Error [${response.status}]: ${errorData.error?.message || response.statusText}`,
          );

          if (response.status === 429 && attempt < this.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
            console.log(
              `[OpenAITextClient] ⏳ Rate limit，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
            );
            await this.sleep(delay);
            continue;
          }

          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = 2000 * attempt;
            console.log(
              `[OpenAITextClient] ⚠️ 伺服器錯誤，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
            );
            await this.sleep(delay);
            continue;
          }

          throw error;
        }

        const data = (await response.json()) as OpenAITextResponse;

        if (attempt > 1) {
          console.log(`[OpenAITextClient] ✅ 重試成功 (第 ${attempt} 次嘗試)`);
        }

        return data;
      } catch (error: unknown) {
        lastError = error as Error;

        if (error instanceof Error && error.name === "AbortError") {
          console.log(`[OpenAITextClient] ⏱️ 請求超時 (${this.timeout}ms)`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.log(`[OpenAITextClient] 🌐 網路錯誤: ${error.message}`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        throw error;
      }
    }

    throw new Error(
      `OpenAI Text API 請求失敗（已重試 ${this.maxRetries} 次）: ${lastError?.message || "Unknown error"}`,
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

let globalClient: OpenAITextClient | null = null;

export function getOpenAITextClient(
  config?: OpenAITextClientConfig,
): OpenAITextClient {
  if (!globalClient) {
    globalClient = new OpenAITextClient(config);
  }
  return globalClient;
}

export function resetOpenAITextClient(): void {
  globalClient = null;
}

export default OpenAITextClient;
