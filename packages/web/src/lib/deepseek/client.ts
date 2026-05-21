/**
 * DeepSeek Official API Client
 *
 * 支援 DeepSeek 官方 API 的客戶端（通過 Cloudflare AI Gateway）
 * API 文件: https://api-docs.deepseek.com/
 */

import {
  getDeepSeekBaseUrl,
  buildDeepSeekHeaders,
  isGatewayEnabled,
} from "@shared/ai-gateway";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekCompletionOptions {
  model: "deepseek-reasoner" | "deepseek-chat";
  messages: DeepSeekMessage[];
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

export interface DeepSeekUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
}

export interface DeepSeekChoice {
  index: number;
  message: {
    role: "assistant";
    content: string;
  };
  finish_reason: "stop" | "length" | "content_filter" | null;
}

export interface DeepSeekCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: DeepSeekChoice[];
  usage: DeepSeekUsage;
  system_fingerprint?: string;
}

export interface DeepSeekError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface DeepSeekClientConfig {
  apiKey?: string;
  baseURL?: string;
  timeout?: number;
  maxRetries?: number;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

/**
 * DeepSeek 官方 API 客戶端
 */
export class DeepSeekClient {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(config: DeepSeekClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.DEEPSEEK_API_KEY || "";
    this.baseURL = config.baseURL || getDeepSeekBaseUrl();
    this.timeout = config.timeout || 120000;
    this.maxRetries = config.maxRetries || 3;
    this.defaultTemperature = config.defaultTemperature || 0.7;
    this.defaultMaxTokens = config.defaultMaxTokens || 16000;

    if (!this.apiKey) {
      console.warn(
        "[DeepSeekClient] ⚠️ API Key 未設定，請設定 DEEPSEEK_API_KEY 環境變數",
      );
    }
  }

  /**
   * 驗證 API Key 是否有效
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * 聊天完成 API（主要方法）
   */
  async chat(
    options: DeepSeekCompletionOptions,
  ): Promise<DeepSeekCompletionResponse> {
    if (!this.isConfigured()) {
      throw new Error("DeepSeek API Key 未設定");
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

    // 移除 undefined 值
    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key as keyof typeof requestBody] === undefined) {
        delete requestBody[key as keyof typeof requestBody];
      }
    });

    return this.makeRequest("/v1/chat/completions", requestBody);
  }

  /**
   * 簡化的完成方法（相容 OpenAI 風格）
   */
  async complete(params: {
    model: "deepseek-reasoner" | "deepseek-chat";
    prompt: string | DeepSeekMessage[];
    temperature?: number;
    max_tokens?: number;
    responseFormat?: "text" | "json";
  }): Promise<{
    content: string;
    usage: DeepSeekUsage;
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

  /**
   * 發送 HTTP 請求（含 retry 機制和 Gateway fallback）
   */
  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<DeepSeekCompletionResponse> {
    const useGateway = isGatewayEnabled();

    // 先嘗試 Gateway 模式
    if (useGateway) {
      try {
        return await this.makeRequestInternal(endpoint, body, true);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        // 如果是 Error 2005（Gateway 無法從 provider 取得回應），嘗試直連
        if (
          err.message.includes("2005") ||
          err.message.includes("Failed to get response from provider")
        ) {
          console.log(
            "[DeepSeekClient] ⚠️ Gateway Error 2005, 自動切換到直連 DeepSeek API...",
          );
          return await this.makeRequestInternal(endpoint, body, false);
        }
        throw error;
      }
    }

    return await this.makeRequestInternal(endpoint, body, false);
  }

  private async makeRequestInternal(
    endpoint: string,
    body: Record<string, unknown>,
    useGateway: boolean,
  ): Promise<DeepSeekCompletionResponse> {
    let url: string;
    let headers: Record<string, string>;

    if (useGateway) {
      // Gateway 模式: .../deepseek/chat/completions（不需要 /v1）
      const actualEndpoint = endpoint.replace("/v1/", "/");
      url = `${this.baseURL}${actualEndpoint}`;
      headers = buildDeepSeekHeaders(this.apiKey);
    } else {
      // 直連模式: https://api.deepseek.com/v1/chat/completions
      url = `https://api.deepseek.com${endpoint}`;
      headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      };
    }

    console.log(`[DeepSeekClient] API (gateway: ${useGateway}, url: ${url})`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // 處理 HTTP 錯誤
        if (!response.ok) {
          const errorData = (await response.json()) as DeepSeekError;
          const error = new Error(
            `DeepSeek API Error [${response.status}]: ${errorData.error?.message || response.statusText}`,
          );

          // Rate limit 錯誤，使用指數退避重試
          if (response.status === 429) {
            if (attempt < this.maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
              console.log(
                `[DeepSeekClient] ⏳ Rate limit，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
              );
              await this.sleep(delay);
              continue;
            }
          }

          // 服務器錯誤（5xx），重試
          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = 2000 * attempt;
            console.log(
              `[DeepSeekClient] ⚠️ 伺服器錯誤，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
            );
            await this.sleep(delay);
            continue;
          }

          throw error;
        }

        const data = (await response.json()) as DeepSeekCompletionResponse;

        // 記錄成功請求
        if (attempt > 1) {
          console.log(`[DeepSeekClient] ✅ 重試成功 (第 ${attempt} 次嘗試)`);
        }
        if (!useGateway) {
          console.log("[DeepSeekClient] ✅ 直連 DeepSeek API 成功");
        }

        return data;
      } catch (error: unknown) {
        lastError = error as Error;

        // Timeout 錯誤
        if (error instanceof Error && error.name === "AbortError") {
          console.log(`[DeepSeekClient] ⏱️ 請求超時 (${this.timeout}ms)`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        // 網路錯誤
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.log(`[DeepSeekClient] 🌐 網路錯誤: ${error.message}`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        // 其他錯誤不重試
        throw error;
      }
    }

    throw new Error(
      `DeepSeek API 請求失敗（已重試 ${this.maxRetries} 次）: ${lastError?.message || "Unknown error"}`,
    );
  }

  /**
   * Sleep 工具函數
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 驗證模型 ID 是否有效
   */
  static isValidModel(
    modelId: string,
  ): modelId is "deepseek-reasoner" | "deepseek-chat" {
    return modelId === "deepseek-reasoner" || modelId === "deepseek-chat";
  }

  /**
   * 根據處理階段推薦模型
   */
  static recommendModel(
    tier: "complex" | "simple",
  ): "deepseek-reasoner" | "deepseek-chat" {
    return tier === "complex" ? "deepseek-reasoner" : "deepseek-chat";
  }
}

/**
 * 獲取全域 DeepSeek 客戶端實例（單例模式）
 */
let globalClient: DeepSeekClient | null = null;

export function getDeepSeekClient(
  config?: DeepSeekClientConfig,
): DeepSeekClient {
  if (!globalClient) {
    globalClient = new DeepSeekClient(config);
  }
  return globalClient;
}

/**
 * 重置全域客戶端（主要用於測試）
 */
export function resetDeepSeekClient(): void {
  globalClient = null;
}

// 預設導出
export default DeepSeekClient;
