/**
 * OpenAI Official Image API Client
 *
 * 支援 OpenAI 官方圖片生成 API
 * API 文件: https://platform.openai.com/docs/guides/images
 *
 * Rate Limits (gpt-image-1-mini):
 * - TPM: 800,000 tokens per minute
 * - RPM: 50 images per minute
 */

import {
  getOpenAIBaseUrl,
  getGatewayHeaders,
  isGatewayEnabled,
} from "@shared/ai-gateway";

export interface OpenAIImageGenerationOptions {
  /**
   * 圖片生成模型
   * 目前支援: gpt-image-1-mini, dall-e-2, dall-e-3
   */
  model: string;

  /**
   * 圖片描述 Prompt
   */
  prompt: string;

  /**
   * 圖片數量（1-10）
   * dall-e-3 只支援 1 張
   */
  n?: number;

  /**
   * 圖片尺寸
   * dall-e-2: "256x256", "512x512", "1024x1024"
   * dall-e-3: "1024x1024", "1792x1024", "1024x1792"
   * gpt-image-1-mini: "1024x1024"
   */
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";

  /**
   * 圖片品質（dall-e-3 only）
   * - "standard": 標準品質
   * - "hd": 高品質（更貴）
   */
  quality?: "standard" | "hd";

  /**
   * 回應格式
   * - "url": 返回圖片 URL（預設）
   * - "b64_json": 返回 Base64 編碼
   */
  response_format?: "url" | "b64_json";

  /**
   * 使用者 ID（選填，用於追蹤）
   */
  user?: string;
}

export interface OpenAIImageData {
  /**
   * 圖片 URL（response_format = "url" 時）
   */
  url?: string;

  /**
   * Base64 編碼圖片（response_format = "b64_json" 時）
   */
  b64_json?: string;

  /**
   * 修訂後的 Prompt（dall-e-3 會自動優化 prompt）
   */
  revised_prompt?: string;
}

export interface OpenAIImageResponse {
  created: number;
  data: OpenAIImageData[];
}

export interface OpenAIImageError {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export interface OpenAIImageClientConfig {
  apiKey?: string;
  organization?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * OpenAI 圖片生成 API 客戶端
 */
export class OpenAIImageClient {
  private apiKey: string;
  private organization?: string;
  private timeout: number;
  private maxRetries: number;

  private get baseURL(): string {
    return getOpenAIBaseUrl();
  }

  constructor(config: OpenAIImageClientConfig = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
    this.organization = config.organization || process.env.OPENAI_ORGANIZATION;
    this.timeout = config.timeout || 120000; // 120 秒（圖片生成較慢）
    this.maxRetries = config.maxRetries || 3;

    if (!this.apiKey) {
      console.warn(
        "[OpenAIImageClient] ⚠️ API Key 未設定，請設定 OPENAI_API_KEY 環境變數",
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
   * 生成圖片（主要方法）
   */
  async generate(
    options: OpenAIImageGenerationOptions,
  ): Promise<OpenAIImageResponse> {
    if (!this.isConfigured()) {
      throw new Error("OpenAI API Key 未設定");
    }

    // 驗證參數
    this.validateOptions(options);

    const requestBody: Record<string, unknown> = {
      model: options.model,
      prompt: options.prompt,
      n: options.n,
      size: options.size || "1024x1024",
      user: options.user,
    };

    // 只有 dall-e-3 支援 quality 和 response_format
    if (options.model === "dall-e-3") {
      if (options.quality) {
        requestBody.quality = options.quality;
      }
      if (options.response_format) {
        requestBody.response_format = options.response_format;
      }
    }

    // 移除 undefined 值
    Object.keys(requestBody).forEach((key) => {
      if (requestBody[key] === undefined) {
        delete requestBody[key];
      }
    });

    return this.makeRequest("/images/generations", requestBody);
  }

  /**
   * 簡化的圖片生成方法
   */
  async generateImage(params: {
    model?: string;
    prompt: string;
    size?: string;
    quality?: "standard" | "hd";
  }): Promise<{
    url: string;
    revisedPrompt?: string;
  }> {
    const response = await this.generate({
      model: params.model || "gpt-image-1-mini",
      prompt: params.prompt,
      size:
        (params.size as OpenAIImageGenerationOptions["size"]) || "1024x1024",
      quality: params.quality,
      n: 1,
    });

    const imageData = response.data[0];

    if (!imageData.url) {
      throw new Error("圖片生成成功但沒有返回 URL");
    }

    return {
      url: imageData.url,
      revisedPrompt: imageData.revised_prompt,
    };
  }

  /**
   * 批量生成圖片
   */
  async generateMultiple(params: {
    model?: string;
    prompt: string;
    count: number;
    size?: string;
    quality?: "standard" | "hd";
  }): Promise<
    Array<{
      url: string;
      revisedPrompt?: string;
    }>
  > {
    // dall-e-3 只支援單張，需要多次呼叫
    const isDalle3 = params.model === "dall-e-3";

    if (isDalle3 && params.count > 1) {
      const promises = Array.from({ length: params.count }, () =>
        this.generateImage({
          model: params.model,
          prompt: params.prompt,
          size: params.size,
          quality: params.quality,
        }),
      );

      return Promise.all(promises);
    }

    // 其他模型可以一次生成多張
    const response = await this.generate({
      model: params.model || "gpt-image-1-mini",
      prompt: params.prompt,
      size:
        (params.size as OpenAIImageGenerationOptions["size"]) || "1024x1024",
      quality: params.quality,
      n: Math.min(params.count, 10), // 最多 10 張
    });

    return response.data.map((data) => ({
      url: data.url!,
      revisedPrompt: data.revised_prompt,
    }));
  }

  /**
   * 驗證參數
   */
  private validateOptions(options: OpenAIImageGenerationOptions): void {
    // 驗證圖片數量
    if (options.n !== undefined) {
      if (options.n < 1 || options.n > 10) {
        throw new Error("圖片數量必須在 1-10 之間");
      }

      if (options.model === "dall-e-3" && options.n > 1) {
        throw new Error("dall-e-3 只支援生成 1 張圖片");
      }
    }

    // 驗證尺寸
    if (options.size) {
      const validSizes = {
        "dall-e-2": ["256x256", "512x512", "1024x1024"],
        "dall-e-3": ["1024x1024", "1792x1024", "1024x1792"],
        "gpt-image-1-mini": ["1024x1024"],
      };

      const modelSizes = validSizes[options.model as keyof typeof validSizes];
      if (modelSizes && !modelSizes.includes(options.size)) {
        throw new Error(
          `模型 ${options.model} 不支援尺寸 ${options.size}，支援的尺寸: ${modelSizes.join(", ")}`,
        );
      }
    }

    // 驗證品質（只有 dall-e-3 支援）
    if (options.quality && options.model !== "dall-e-3") {
      console.warn("[OpenAIImageClient] ⚠️ 只有 dall-e-3 支援 quality 參數");
    }
  }

  /**
   * 發送 HTTP 請求（含 retry 機制）
   */
  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>,
  ): Promise<OpenAIImageResponse> {
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

        // 處理 HTTP 錯誤
        if (!response.ok) {
          const errorData = (await response.json()) as OpenAIImageError;
          const error = new Error(
            `OpenAI Image API Error [${response.status}]: ${errorData.error?.message || response.statusText}`,
          );

          // Rate limit 錯誤
          if (response.status === 429) {
            if (attempt < this.maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
              console.log(
                `[OpenAIImageClient] ⏳ Rate limit，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
              );
              await this.sleep(delay);
              continue;
            }
          }

          // 服務器錯誤（5xx）
          if (response.status >= 500 && attempt < this.maxRetries) {
            const delay = 2000 * attempt;
            console.log(
              `[OpenAIImageClient] ⚠️ 伺服器錯誤，${delay}ms 後重試 (${attempt}/${this.maxRetries})`,
            );
            await this.sleep(delay);
            continue;
          }

          throw error;
        }

        const data = (await response.json()) as OpenAIImageResponse;

        // 記錄成功請求
        if (attempt > 1) {
          console.log(`[OpenAIImageClient] ✅ 重試成功 (第 ${attempt} 次嘗試)`);
        }

        return data;
      } catch (error: unknown) {
        lastError = error as Error;

        // Timeout 錯誤
        if (error instanceof Error && error.name === "AbortError") {
          console.log(`[OpenAIImageClient] ⏱️ 請求超時 (${this.timeout}ms)`);
          if (attempt < this.maxRetries) {
            await this.sleep(2000 * attempt);
            continue;
          }
        }

        // 網路錯誤
        if (error instanceof TypeError && error.message.includes("fetch")) {
          console.log(`[OpenAIImageClient] 🌐 網路錯誤: ${error.message}`);
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
      `OpenAI Image API 請求失敗（已重試 ${this.maxRetries} 次）: ${lastError?.message || "Unknown error"}`,
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
  static isValidModel(modelId: string): boolean {
    const validModels = ["gpt-image-1-mini", "dall-e-2", "dall-e-3"];
    return validModels.includes(modelId);
  }

  /**
   * 取得模型的預設設定
   */
  static getModelDefaults(modelId: string): {
    size: string;
    maxImages: number;
  } {
    const defaults = {
      "gpt-image-1-mini": { size: "1024x1024", maxImages: 10 },
      "dall-e-2": { size: "1024x1024", maxImages: 10 },
      "dall-e-3": { size: "1024x1024", maxImages: 1 },
    };

    return (
      defaults[modelId as keyof typeof defaults] || defaults["gpt-image-1-mini"]
    );
  }
}

/**
 * 獲取全域 OpenAI Image 客戶端實例（單例模式）
 */
let globalClient: OpenAIImageClient | null = null;

export function getOpenAIImageClient(
  config?: OpenAIImageClientConfig,
): OpenAIImageClient {
  if (!globalClient) {
    globalClient = new OpenAIImageClient(config);
  }
  return globalClient;
}

/**
 * 重置全域客戶端（主要用於測試）
 */
export function resetOpenAIImageClient(): void {
  globalClient = null;
}

// 預設導出
export default OpenAIImageClient;
