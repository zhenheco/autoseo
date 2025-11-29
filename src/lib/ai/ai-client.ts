import { callOpenRouter } from "@/lib/openrouter";
import { getRateLimiter } from "@/lib/rate-limit/rate-limiter";
import type {
  AIClientConfig,
  AICompletionOptions,
  AICompletionResponse,
  AIMessage,
} from "@/types/agents";

export class AIClient {
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;
  }

  private async callDeepSeekAPI(params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    response_format?: { type: string };
  }) {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not set");
    }

    // 為 deepseek-reasoner 設定較長的超時時間（120 秒）
    // 為 deepseek-chat 設定標準超時時間（60 秒）
    const timeoutMs = params.model === "deepseek-reasoner" ? 120000 : 60000;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(
        "https://api.deepseek.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: params.model,
            messages: params.messages,
            temperature: params.temperature ?? 0.7,
            max_tokens: params.max_tokens,
            response_format: params.response_format,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`DeepSeek API error: ${JSON.stringify(error)}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`DeepSeek API timeout after ${timeoutMs / 1000}s`);
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
        const estimatedTokens = options.maxTokens || 2000;
        const isDeepSeekModel = currentModel.includes("deepseek");

        if (!isDeepSeekModel) {
          const rateLimiter = getRateLimiter(currentModel);
          await rateLimiter.acquire(estimatedTokens);
        }

        const responseFormat =
          options.responseFormat ||
          (options.format === "json" ? { type: "json_object" } : undefined);

        let response;

        if (isDeepSeekModel) {
          let deepseekModel = "deepseek-chat";
          let maxTokensLimit = 8192;

          if (currentModel.includes("reasoner")) {
            deepseekModel = "deepseek-reasoner";
            maxTokensLimit = 64000;
          } else if (
            currentModel.includes("chat") ||
            currentModel.includes("v3.2-exp")
          ) {
            deepseekModel = "deepseek-chat";
            maxTokensLimit = 8192;
          }

          const maxTokens = Math.min(options.maxTokens ?? 2000, maxTokensLimit);

          response = await this.callDeepSeekAPI({
            model: deepseekModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: maxTokens,
            response_format: responseFormat,
          });
        } else {
          response = await callOpenRouter({
            model: currentModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2000,
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
          (message as any).reasoning_content ||
          message.content ||
          (message as any).reasoning ||
          (message as any).thinking ||
          "";

        console.log("[AIClient] DeepSeek response extraction:", {
          hasContent: !!message.content,
          hasReasoningContent: !!(message as any).reasoning_content,
          hasReasoning: !!(message as any).reasoning,
          hasThinking: !!(message as any).thinking,
          contentLength: content?.length || 0,
        });

        const totalTokens = response.usage?.total_tokens || 0;
        if (!isDeepSeekModel) {
          const rateLimiter = getRateLimiter(currentModel);
          rateLimiter.reportUsage(totalTokens);
        }

        return {
          content,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens,
          },
          model: response.model,
        };
      } catch (error: any) {
        lastError = error;
        const isRateLimit =
          error.message?.includes("rate-limited") ||
          error.message?.includes("429") ||
          error.message?.includes("Rate limit");

        const isTimeout =
          error.message?.includes("timeout") ||
          error.message?.includes("terminated") ||
          error.name === "AbortError";

        // 如果 deepseek-reasoner 超時，自動切換到 deepseek-chat
        if (isTimeout && currentModel.includes("reasoner") && attempt === 1) {
          console.log(
            `[AIClient] ⚠️ ${currentModel} timeout, switching to deepseek-chat`,
          );
          currentModel = "deepseek-chat";
          continue;
        }

        if (isRateLimit) {
          const fallbackModel = this.getFallbackModel(currentModel);

          if (fallbackModel && attempt === 1) {
            console.log(`[AIClient] ⚠️ Rate limit: ${currentModel}`);
            console.log(`[AIClient] 🔄 切換到備用模型: ${fallbackModel}`);
            currentModel = fallbackModel;
            continue;
          }

          if (attempt < maxRetries) {
            const delays = [5000, 10000, 20000];
            const delay = delays[attempt - 1] || 20000;
            console.log(
              `[AIClient] Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
        }

        throw new Error(`AI completion failed: ${error.message}`);
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

  private getFallbackModel(currentModel: string): string | null {
    const fallbackMap: Record<string, string> = {
      // DeepSeek V3 系列：免費版 → 實驗版
      "deepseek/deepseek-chat-v3.1:free": "deepseek/deepseek-v3.2-exp",

      // DeepSeek 3.2-exp → GPT-5 (測試配置：用於 Research/Strategy)
      "deepseek/deepseek-v3.2-exp": "openai/gpt-5",

      // 舊版 DeepSeek 相容
      "deepseek/deepseek-chat": "openai/gpt-5-mini",

      // 其他免費模型 → GPT-5 Mini (cost optimization)
      "google/gemini-2.0-flash-exp:free": "openai/gpt-5-mini",
      "google/gemini-flash-1.5:free": "openai/gpt-5-mini",
      "meta-llama/llama-3.2-3b-instruct:free": "openai/gpt-5-mini",
      "qwen/qwen-2.5-7b-instruct:free": "openai/gpt-5-mini",

      // GPT-5 → Gemini 2.5 Pro
      "openai/gpt-5": "google/gemini-2.5-pro",
      "openai/gpt-4o": "google/gemini-2.5-pro",
    };

    return fallbackMap[currentModel] || null;
  }

  async generateImage(
    prompt: string,
    options: {
      model: string;
      quality?: "low" | "medium" | "high" | "auto";
      size?: string;
    },
  ): Promise<{ url: string; revisedPrompt?: string }> {
    try {
      if (
        options.model.includes("gemini-imagen") ||
        options.model.includes("imagen-3")
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

        const response = await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

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

      // 處理 nano-banana 模型（使用 Gemini generateContent API）
      if (options.model.includes("nano-banana")) {
        return await this.callGeminiImageAPI(prompt, options);
      }

      // 處理 dall-e-3 模型（使用 OpenAI 官方 API）
      if (options.model.includes("dall-e")) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
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

        const response = await fetch(
          "https://api.openai.com/v1/images/generations",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

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
    } catch (error: any) {
      throw new Error(`Image generation failed: ${error.message}`);
    }
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

    const modelName = options.model.includes("flash")
      ? "imagen-3.0-generate-002"
      : "imagen-3.0-generate-001";

    const [width, height] = (options.size || "1024x1024")
      .split("x")
      .map(Number);
    const aspectRatio =
      width === height ? "1:1" : width > height ? "16:9" : "9:16";

    console.log(
      `[AIClient] 🎨 Calling Gemini Imagen API (model: ${modelName}, aspect: ${aspectRatio})`,
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio,
            outputOptions: {
              mimeType: "image/jpeg",
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini Imagen API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();

    if (!data.predictions || !data.predictions[0]) {
      throw new Error("Invalid Gemini Imagen response structure");
    }

    const imageData = data.predictions[0];
    const base64Data = imageData.bytesBase64Encoded;

    if (!base64Data) {
      throw new Error("No image data in Gemini Imagen response");
    }

    const dataUrl = `data:image/jpeg;base64,${base64Data}`;
    console.log(
      "[AIClient] ✅ Gemini Imagen generated successfully (base64 length:",
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

    const imageSize = width >= 2048 || height >= 2048 ? "2K" : "1K";

    const modelName = options.model.includes("pro")
      ? "gemini-2.0-flash-exp"
      : "gemini-2.0-flash-exp";

    console.log(
      `[AIClient] 🎨 Calling Gemini Image API (model: ${modelName}, aspect: ${aspectRatio}, size: ${imageSize})`,
    );

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gemini Image API error (${response.status}): ${errorText}`,
      );
    }

    const data = await response.json();

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
