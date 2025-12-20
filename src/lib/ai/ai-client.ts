import {
  isGatewayEnabled,
  buildGeminiApiUrl,
  buildGeminiHeaders,
  buildOpenAIHeaders,
  getOpenAIBaseUrl,
  getDeepSeekBaseUrl,
  buildDeepSeekHeaders,
} from "@/lib/cloudflare/ai-gateway";
import { OpenRouterClient } from "@/lib/openrouter/client";
import type {
  AIClientConfig,
  AICompletionOptions,
  AICompletionResponse,
  AIMessage,
} from "@/types/agents";

export interface ModelCapability {
  jsonMode: boolean;
  purpose: "text-generation" | "reasoning" | "image-generation" | "research";
}

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  "deepseek-reasoner": { jsonMode: false, purpose: "reasoning" },
  "deepseek-chat": { jsonMode: true, purpose: "text-generation" },
  "gemini-3-pro-image-preview": {
    jsonMode: false,
    purpose: "image-generation",
  },
  "gemini-2.5-flash-image": { jsonMode: false, purpose: "image-generation" },
  "gpt-image-1-mini": { jsonMode: false, purpose: "image-generation" },
  "gpt-5-mini": { jsonMode: true, purpose: "text-generation" },
  "perplexity-research": { jsonMode: false, purpose: "research" },
};

export function supportsJsonMode(model: string): boolean {
  const capability = MODEL_CAPABILITIES[model];
  return capability?.jsonMode ?? false;
}

interface DeepSeekMessage {
  role: string;
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
  thinking?: string;
}

interface DeepSeekResponse {
  choices: Array<{
    message: DeepSeekMessage;
    finish_reason?: "stop" | "length" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model: string;
}

export class AIClient {
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  /**
   * 5 層 Fallback 機制：
   * 1. Gateway DeepSeek (當前模型)
   * 2. Gateway OpenRouter DeepSeek (deepseek/deepseek-v3.2)
   * 3. 直連 DeepSeek API
   * 4. Gateway OpenAI (gpt-5/gpt-5-mini)
   * 5. 直連 OpenAI
   */
  private async callDeepSeekAPI(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
  }) {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    const errors: string[] = [];

    // === Step 1: Gateway DeepSeek ===
    if (isGatewayEnabled() && deepseekApiKey) {
      try {
        console.log(`[AIClient] 🔄 Step 1: Gateway DeepSeek (${params.model})`);
        return await this.callDeepSeekAPIInternal(params, deepseekApiKey, true);
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`Gateway DeepSeek: ${err.message}`);
        console.log(`[AIClient] ⚠️ Step 1 失敗: ${err.message}`);
      }
    }

    // === Step 2: Gateway OpenRouter DeepSeek ===
    const openRouterClient = new OpenRouterClient();
    if (openRouterClient.isConfigured()) {
      try {
        console.log(
          "[AIClient] 🔄 Step 2: Gateway OpenRouter (deepseek/deepseek-v3.2)",
        );
        const response = await openRouterClient.chat({
          model: "deepseek/deepseek-v3.2",
          messages: params.messages.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
          temperature: params.temperature,
          max_tokens: params.max_tokens,
          response_format: params.response_format as
            | { type: "text" | "json_object" }
            | undefined,
        });
        console.log(
          "[AIClient] ✅ Step 2 成功: Gateway OpenRouter (deepseek/deepseek-v3.2)",
        );
        return {
          choices: response.choices.map((c) => ({
            message: { role: c.message.role, content: c.message.content },
          })),
          usage: response.usage,
          model: response.model,
        } as DeepSeekResponse;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`OpenRouter DeepSeek: ${err.message}`);
        console.log(`[AIClient] ⚠️ Step 2 失敗: ${err.message}`);
      }
    }

    // === Step 3: 直連 DeepSeek API ===
    if (deepseekApiKey) {
      try {
        console.log(
          `[AIClient] 🔄 Step 3: 直連 DeepSeek API (${params.model})`,
        );
        const result = await this.callDeepSeekAPIInternal(
          params,
          deepseekApiKey,
          false,
        );
        console.log("[AIClient] ✅ Step 3 成功: 直連 DeepSeek API");
        return result;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`直連 DeepSeek: ${err.message}`);
        console.log(`[AIClient] ⚠️ Step 3 失敗: ${err.message}`);
      }
    }

    // === Step 4: Gateway OpenAI ===
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (isGatewayEnabled() && openaiApiKey) {
      try {
        console.log("[AIClient] 🔄 Step 4: Gateway OpenAI");
        const result = await this.callOpenAIAPI(params, openaiApiKey, true);
        console.log("[AIClient] ✅ Step 4 成功: Gateway OpenAI");
        return result;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`Gateway OpenAI: ${err.message}`);
        console.log(`[AIClient] ⚠️ Step 4 失敗: ${err.message}`);
      }
    }

    // === Step 5: 直連 OpenAI ===
    if (openaiApiKey) {
      try {
        console.log("[AIClient] 🔄 Step 5: 直連 OpenAI");
        const result = await this.callOpenAIAPI(params, openaiApiKey, false);
        console.log("[AIClient] ✅ Step 5 成功: 直連 OpenAI");
        return result;
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        errors.push(`直連 OpenAI: ${err.message}`);
        console.log(`[AIClient] ⚠️ Step 5 失敗: ${err.message}`);
      }
    }

    // 所有 fallback 都失敗
    throw new Error(
      `所有 AI Provider 都失敗了:\n${errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}`,
    );
  }

  private async callDeepSeekAPIInternal(
    params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    },
    apiKey: string,
    useGateway: boolean,
  ) {
    // 為所有 DeepSeek 模型設定較長的超時時間（300 秒 / 5 分鐘）
    // 翻譯任務需要多次 API 呼叫，每次呼叫可能需要較長時間
    const timeoutMs = 300000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      let endpoint: string;
      let headers: Record<string, string>;

      if (useGateway) {
        // Gateway 模式: .../deepseek/chat/completions（不需要 /v1）
        const baseUrl = getDeepSeekBaseUrl();
        endpoint = `${baseUrl}/chat/completions`;
        headers = buildDeepSeekHeaders(apiKey);
      } else {
        // 直連模式: https://api.deepseek.com/v1/chat/completions
        endpoint = "https://api.deepseek.com/v1/chat/completions";
        headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        };
      }

      console.log(
        `[AIClient] DeepSeek API (gateway: ${useGateway}, url: ${endpoint}, max_tokens: ${params.max_tokens})`,
      );

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.max_tokens,
          response_format: params.response_format,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 安全解析 JSON 響應
      let responseText: string;
      try {
        responseText = await response.text();
      } catch (textError) {
        throw new Error(
          `DeepSeek API 響應讀取失敗: ${textError instanceof Error ? textError.message : "unknown"}`,
        );
      }

      let result: DeepSeekResponse;
      try {
        result = JSON.parse(responseText) as DeepSeekResponse;
      } catch (parseError) {
        // 安全：不記錄響應內容，只記錄錯誤狀態
        console.error(
          `[AIClient] JSON 解析失敗 (響應長度: ${responseText.length})`,
        );
        throw new Error(
          `DeepSeek API 響應不是有效 JSON: ${parseError instanceof Error ? parseError.message : "parse error"}`,
        );
      }

      if (!response.ok) {
        // 安全：只記錄錯誤碼，不記錄完整響應
        const errorObj = result as unknown as { error?: { code?: string } };
        const errorCode = errorObj.error?.code || response.status;
        throw new Error(`DeepSeek API error: ${errorCode}`);
      }

      // 檢查 finish_reason
      const finishReason = result.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        console.warn(
          `[AIClient] ⚠️ 輸出被截斷 (finish_reason=length)，max_tokens=${params.max_tokens}，考慮增加 token 限制`,
        );
      }

      if (!useGateway) {
        console.log("[AIClient] ✅ 直連 DeepSeek API 成功");
      }

      console.log(
        `[AIClient] ✅ DeepSeek 完成 (finish_reason=${finishReason}, tokens=${result.usage?.total_tokens || "unknown"})`,
      );

      return result;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`DeepSeek API timeout after ${timeoutMs / 1000}s`);
      }
      throw error;
    }
  }

  /**
   * OpenAI API 呼叫（用於 Fallback）
   */
  private async callOpenAIAPI(
    params: {
      model: string;
      messages: Array<{ role: string; content: string }>;
      temperature?: number;
      max_tokens?: number;
      response_format?: { type: string };
    },
    apiKey: string,
    useGateway: boolean,
  ): Promise<DeepSeekResponse> {
    const timeoutMs = 120000; // 2 分鐘
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // 模型映射：deepseek-reasoner → gpt-5, deepseek-chat → gpt-5-mini
    const openaiModel = params.model.includes("reasoner")
      ? "gpt-5"
      : "gpt-5-mini";

    try {
      const baseUrl = useGateway
        ? getOpenAIBaseUrl()
        : "https://api.openai.com";

      const headers = useGateway
        ? buildOpenAIHeaders(apiKey)
        : {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          };

      console.log(
        `[AIClient] OpenAI API (gateway: ${useGateway}, model: ${openaiModel})`,
      );

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: openaiModel,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.max_tokens ?? 8192,
          response_format: params.response_format,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      return {
        choices: data.choices.map(
          (c: { message: { role: string; content: string } }) => ({
            message: { role: c.message.role, content: c.message.content },
          }),
        ),
        usage: data.usage,
        model: data.model,
      } as DeepSeekResponse;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenAI API timeout after ${timeoutMs / 1000}s`);
      }
      throw error;
    }
  }

  async complete(
    prompt: string | AIMessage[],
    options: AICompletionOptions,
  ): Promise<AICompletionResponse> {
    const messages = this.formatMessages(prompt);
    const maxRetries = 3;
    let lastError: Error | null = null;
    let currentModel = options.model;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const modelSupportsJson = supportsJsonMode(currentModel);
        const wantsJsonFormat =
          options.format === "json" ||
          options.responseFormat?.type === "json_object";

        const responseFormat =
          wantsJsonFormat && modelSupportsJson
            ? { type: "json_object" }
            : undefined;

        if (
          wantsJsonFormat &&
          !modelSupportsJson &&
          process.env.NODE_ENV === "development"
        ) {
          console.debug(
            `[AIClient] Model ${currentModel} does not support JSON mode, using parser fallback`,
          );
        }

        let deepseekModel = "deepseek-chat";
        let maxTokensLimit = 8192;

        if (currentModel.includes("reasoner")) {
          deepseekModel = "deepseek-reasoner";
          maxTokensLimit = 64000;
        } else {
          deepseekModel = "deepseek-chat";
          maxTokensLimit = 8192;
        }

        const maxTokens = Math.min(options.maxTokens ?? 8000, maxTokensLimit);

        let response = await this.callDeepSeekAPI({
          model: deepseekModel,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: maxTokens,
          response_format: responseFormat,
        });

        // 截斷重試邏輯：如果 finish_reason=length，自動增加 token 重試一次
        const finishReason = response.choices?.[0]?.finish_reason;
        if (
          finishReason === "length" &&
          attempt === 1 &&
          maxTokens < maxTokensLimit
        ) {
          const increasedTokens = Math.min(
            Math.floor(maxTokens * 1.5),
            maxTokensLimit,
          );
          console.warn(
            `[AIClient] ⚠️ 輸出被截斷，自動重試 (${maxTokens} → ${increasedTokens} tokens)`,
          );

          response = await this.callDeepSeekAPI({
            model: deepseekModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: increasedTokens,
            response_format: responseFormat,
          });
        }

        if (currentModel !== options.model) {
          console.log(
            `[AIClient] ✅ Fallback 成功使用: ${currentModel} (原: ${options.model})`,
          );
        }

        const message = response.choices[0].message;

        const content =
          message.content ||
          message.reasoning_content ||
          message.reasoning ||
          message.thinking ||
          "";

        console.log("[AIClient] DeepSeek response extraction:", {
          hasContent: !!message.content,
          hasReasoningContent: !!message.reasoning_content,
          hasReasoning: !!message.reasoning,
          hasThinking: !!message.thinking,
          contentLength: content?.length || 0,
        });

        const totalTokens = response.usage?.total_tokens || 0;

        return {
          content,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens,
          },
          model: response.model,
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        const isRateLimit =
          err.message?.includes("rate-limited") ||
          err.message?.includes("429") ||
          err.message?.includes("Rate limit");

        const isTimeout =
          err.message?.includes("timeout") ||
          err.message?.includes("terminated") ||
          err.name === "AbortError";

        // 如果 deepseek-reasoner 超時，自動切換到 deepseek-chat
        if (isTimeout && currentModel.includes("reasoner") && attempt === 1) {
          console.log(
            `[AIClient] ⚠️ ${currentModel} timeout, switching to deepseek-chat`,
          );
          currentModel = "deepseek-chat";
          continue;
        }

        // 如果 timeout 且還有重試次數，等待後重試
        if (isTimeout && attempt < maxRetries) {
          const delay = 3000;
          console.log(
            `[AIClient] ⚠️ Timeout, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isRateLimit && attempt < maxRetries) {
          const delays = [5000, 10000, 20000];
          const delay = delays[attempt - 1] || 20000;
          console.log(
            `[AIClient] Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw new Error(`AI completion failed: ${err.message}`);
      }
    }

    throw new Error(
      `AI completion failed after ${maxRetries} attempts: ${lastError?.message}`,
    );
  }

  private formatMessages(prompt: string | AIMessage[]): AIMessage[] {
    if (typeof prompt === "string") {
      return [{ role: "user", content: prompt }];
    }
    return prompt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async tryGenerateWithRetries(
    prompt: string,
    options: {
      model: string;
      quality?: "low" | "medium" | "high" | "auto";
      size?: string;
    },
    maxRetries: number,
  ): Promise<{
    success: boolean;
    data?: { url: string; revisedPrompt?: string };
    error?: Error;
  }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[AIClient] 🎨 Image attempt ${attempt}/${maxRetries} with ${options.model}`,
        );
        const result = await this.generateImageWithModel(prompt, options);
        return { success: true, data: result };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `[AIClient] ⚠️ Attempt ${attempt} failed: ${lastError.message}`,
        );

        if (attempt < maxRetries) {
          const delay = 2000 * attempt;
          console.log(`[AIClient] ⏳ Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    return { success: false, error: lastError! };
  }

  async generateImage(
    prompt: string,
    options: {
      model: string;
      quality?: "low" | "medium" | "high" | "auto";
      size?: string;
    },
  ): Promise<{ url: string; revisedPrompt?: string }> {
    const MAX_RETRIES = 3;
    const FALLBACK_MODEL = "gemini-2.5-flash-image";

    // 第一階段：嘗試主要模型（最多 3 次）
    const primaryResult = await this.tryGenerateWithRetries(
      prompt,
      options,
      MAX_RETRIES,
    );
    if (primaryResult.success && primaryResult.data) {
      return primaryResult.data;
    }

    // 第二階段：主要模型失敗，切換到 fallback 模型（也重試 3 次）
    if (options.model !== FALLBACK_MODEL) {
      console.warn(
        `[AIClient] ⚠️ ${options.model} failed ${MAX_RETRIES}x, switching to ${FALLBACK_MODEL}`,
      );
      const fallbackResult = await this.tryGenerateWithRetries(
        prompt,
        { ...options, model: FALLBACK_MODEL },
        MAX_RETRIES,
      );
      if (fallbackResult.success && fallbackResult.data) {
        console.log(`[AIClient] ✅ Fallback to ${FALLBACK_MODEL} succeeded`);
        return fallbackResult.data;
      }
    }

    throw primaryResult.error || new Error("Image generation failed");
  }

  private async generateImageWithModel(
    prompt: string,
    options: {
      model: string;
      quality?: "low" | "medium" | "high" | "auto";
      size?: string;
    },
  ): Promise<{ url: string; revisedPrompt?: string }> {
    if (
      options.model.includes("gemini-imagen") ||
      options.model.includes("imagen-3") ||
      options.model.includes("gemini-2.5-flash-image")
    ) {
      return await this.callGeminiImagenAPI(prompt, options);
    }

    if (
      options.model.includes("gpt-image-1") ||
      options.model.includes("chatgpt-image")
    ) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set");
      }

      // 直接使用指定的模型（支援 gpt-image-1-mini, gpt-image-1 等）
      const requestBody: Record<string, unknown> = {
        model: options.model,
        prompt: prompt,
        n: 1,
        size: options.size || "1024x1024",
      };

      // 加入 quality 參數（支援 standard, hd, medium 等）
      if (options.quality) {
        requestBody.quality = options.quality;
      }

      const openaiBaseUrl = getOpenAIBaseUrl();
      const openaiHeaders = buildOpenAIHeaders(apiKey);

      const response = await fetch(`${openaiBaseUrl}/v1/images/generations`, {
        method: "POST",
        headers: openaiHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0]) {
        throw new Error("Invalid OpenAI image response structure");
      }

      const imageData = data.data[0];

      if (imageData.b64_json) {
        const base64Data = imageData.b64_json;
        const dataUrl = `data:image/png;base64,${base64Data}`;

        console.log(
          "[AIClient] Generated image from b64_json (base64 length:",
          base64Data.length,
          ")",
        );

        return {
          url: dataUrl,
          revisedPrompt: imageData.revised_prompt || prompt,
        };
      } else if (imageData.url) {
        console.log("[AIClient] Generated image from URL:", imageData.url);

        return {
          url: imageData.url,
          revisedPrompt: imageData.revised_prompt || prompt,
        };
      } else {
        throw new Error("No image URL or b64_json in OpenAI response");
      }
    }

    // 處理 Gemini 3 Pro Image Preview / nano-banana 模型（使用 Gemini generateContent API）
    if (
      options.model.includes("gemini-3-pro-image-preview") ||
      options.model.includes("nano-banana")
    ) {
      return await this.callGeminiImageAPI(prompt, options);
    }

    // 處理 dall-e-3 模型（使用 OpenAI 官方 API）
    if (options.model.includes("dall-e")) {
      const dalleApiKey = process.env.OPENAI_API_KEY;
      if (!dalleApiKey) {
        throw new Error("OPENAI_API_KEY is not set");
      }

      const requestBody: Record<string, unknown> = {
        model: options.model,
        prompt: prompt,
        n: 1,
        size: options.size || "1024x1024",
        response_format: "b64_json",
      };

      if (options.quality) {
        requestBody.quality = options.quality === "high" ? "hd" : "standard";
      }

      const dalleBaseUrl = getOpenAIBaseUrl();
      const dalleHeaders = buildOpenAIHeaders(dalleApiKey);

      const response = await fetch(`${dalleBaseUrl}/v1/images/generations`, {
        method: "POST",
        headers: dalleHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`DALL-E API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      const imageData = data.data[0];

      if (imageData.b64_json) {
        return {
          url: `data:image/png;base64,${imageData.b64_json}`,
          revisedPrompt: imageData.revised_prompt || prompt,
        };
      } else if (imageData.url) {
        return {
          url: imageData.url,
          revisedPrompt: imageData.revised_prompt || prompt,
        };
      }

      throw new Error("No image data in DALL-E response");
    }

    throw new Error(`Unsupported image model: ${options.model}`);
  }

  private mapGeminiImageModel(model: string): string {
    const modelMap: Record<string, string> = {
      "gemini-3-pro-image-preview": "gemini-3-pro-image-preview",
      "gemini-imagen-flash": "gemini-2.5-flash-image",
      "gemini-imagen": "gemini-2.5-flash-image",
      "imagen-3": "gemini-2.5-flash-image",
      "gemini-2.5-flash-image": "gemini-2.5-flash-image",
    };
    return modelMap[model] || model;
  }

  private async callGeminiImagenAPI(
    prompt: string,
    options: {
      model: string;
      quality?: "low" | "medium" | "high" | "auto";
      size?: string;
    },
  ): Promise<{ url: string; revisedPrompt?: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const modelName = this.mapGeminiImageModel(options.model);

    const [width, height] = (options.size || "1024x1024")
      .split("x")
      .map(Number);
    const aspectRatio =
      width === height ? "1:1" : width > height ? "16:9" : "9:16";

    console.log(
      `[AIClient] 🎨 Calling Gemini Image API (model: ${modelName}, requested: ${options.model}, aspect: ${aspectRatio}, gateway: ${isGatewayEnabled()})`,
    );

    // Gateway 模式使用 Gateway URL，直連模式使用官方 URL（帶 key 參數）
    const geminiUrl = isGatewayEnabled()
      ? buildGeminiApiUrl(modelName, "generateContent")
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiHeaders = buildGeminiHeaders(apiKey);

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: geminiHeaders,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio,
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini Image API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === "NO_IMAGE") {
      throw new Error(`[NO_IMAGE] Gemini refused to generate image for prompt`);
    }

    const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      throw new Error(
        "Invalid Gemini Image response structure: " + JSON.stringify(data),
      );
    }

    const base64Data = inlineData.data;
    const mimeType = inlineData.mimeType || "image/png";

    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    console.log(
      "[AIClient] ✅ Gemini Image generated successfully (base64 length:",
      base64Data.length,
      ")",
    );

    return {
      url: dataUrl,
      revisedPrompt: prompt,
    };
  }

  private async callGeminiImageAPI(
    prompt: string,
    options: {
      model: string;
      quality?: "low" | "medium" | "high" | "auto";
      size?: string;
    },
  ): Promise<{ url: string; revisedPrompt?: string }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }

    const [width, height] = (options.size || "1024x1024")
      .split("x")
      .map(Number);
    let aspectRatio = "1:1";
    if (width > height) {
      aspectRatio = width / height >= 1.7 ? "16:9" : "4:3";
    } else if (height > width) {
      aspectRatio = height / width >= 1.7 ? "9:16" : "3:4";
    }

    const modelName = options.model.includes("gemini-3-pro")
      ? "gemini-3-pro-image-preview"
      : "gemini-2.5-flash-image";

    console.log(
      `[AIClient] 🎨 Calling Gemini Image API (model: ${modelName}, aspect: ${aspectRatio}, gateway: ${isGatewayEnabled()})`,
    );

    // Gateway 模式使用 Gateway URL，直連模式使用官方 URL（帶 key 參數）
    const geminiImageUrl = isGatewayEnabled()
      ? buildGeminiApiUrl(modelName, "generateContent")
      : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const geminiImageHeaders = buildGeminiHeaders(apiKey);

    const response = await fetch(geminiImageUrl, {
      method: "POST",
      headers: geminiImageHeaders,
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini Image API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();

    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === "NO_IMAGE") {
      throw new Error(`[NO_IMAGE] Gemini refused to generate image for prompt`);
    }

    if (!data.candidates || !data.candidates[0]?.content?.parts) {
      throw new Error("Invalid Gemini Image API response structure");
    }

    const parts = data.candidates[0].content.parts;
    let imageData: string | null = null;
    let mimeType = "image/png";
    let description = prompt;

    for (const part of parts) {
      if (part.inlineData) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType || "image/png";
      } else if (part.text) {
        description = part.text;
      }
    }

    if (!imageData) {
      throw new Error("No image data in Gemini response");
    }

    const dataUrl = `data:${mimeType};base64,${imageData}`;

    console.log(
      "[AIClient] ✅ Gemini Image generated successfully (base64 length:",
      imageData.length,
      ")",
    );

    return {
      url: dataUrl,
      revisedPrompt: description,
    };
  }
}
