import { callOpenRouter } from '@/lib/openrouter';
import type {
  AIClientConfig,
  AICompletionOptions,
  AICompletionResponse,
  AIMessage,
} from '@/types/agents';

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
      throw new Error('DEEPSEEK_API_KEY is not set');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens,
        response_format: params.response_format,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`DeepSeek API error: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async complete(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const messages = this.formatMessages(prompt);
    const maxRetries = 3;
    let lastError: Error | null = null;
    let currentModel = options.model;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const responseFormat = options.responseFormat ||
          (options.format === 'json' ? { type: 'json_object' } : undefined);

        let response;
        const isDeepSeekModel = currentModel.includes('deepseek');

        if (isDeepSeekModel) {
          let deepseekModel = 'deepseek-chat';
          if (currentModel.includes('reasoner')) {
            deepseekModel = 'deepseek-reasoner';
          } else if (currentModel.includes('chat') || currentModel.includes('v3.2-exp')) {
            deepseekModel = 'deepseek-chat';
          }

          response = await this.callDeepSeekAPI({
            model: deepseekModel,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2000,
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
          console.log(`[AIClient] ✅ Fallback 成功使用: ${currentModel} (原: ${options.model})`);
        }

        const message = response.choices[0].message;

        const content =
          (message as any).reasoning_content ||
          message.content ||
          (message as any).reasoning ||
          (message as any).thinking ||
          '';

        console.log('[AIClient] DeepSeek response extraction:', {
          hasContent: !!message.content,
          hasReasoningContent: !!(message as any).reasoning_content,
          hasReasoning: !!(message as any).reasoning,
          hasThinking: !!(message as any).thinking,
          contentLength: content?.length || 0,
        });

        return {
          content,
          usage: {
            promptTokens: response.usage?.prompt_tokens || 0,
            completionTokens: response.usage?.completion_tokens || 0,
            totalTokens: response.usage?.total_tokens || 0,
          },
          model: response.model,
        };
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error.message?.includes('rate-limited') ||
                          error.message?.includes('429') ||
                          error.message?.includes('Rate limit');

        if (isRateLimit) {
          const fallbackModel = this.getFallbackModel(currentModel);

          if (fallbackModel && attempt === 1) {
            console.log(`[AIClient] ⚠️ Rate limit: ${currentModel}`);
            console.log(`[AIClient] 🔄 切換到備用模型: ${fallbackModel}`);
            currentModel = fallbackModel;
            continue;
          }

          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 60000);
            console.log(`[AIClient] Rate limit hit, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        throw new Error(`AI completion failed: ${error.message}`);
      }
    }

    throw new Error(`AI completion failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  private formatMessages(prompt: string | AIMessage[]): AIMessage[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }
    return prompt;
  }

  private getFallbackModel(currentModel: string): string | null {
    const fallbackMap: Record<string, string> = {
      // DeepSeek V3 系列：免費版 → 實驗版
      'deepseek/deepseek-chat-v3.1:free': 'deepseek/deepseek-v3.2-exp',

      // DeepSeek 3.2-exp → GPT-5 (測試配置：用於 Research/Strategy)
      'deepseek/deepseek-v3.2-exp': 'openai/gpt-5',

      // 舊版 DeepSeek 相容
      'deepseek/deepseek-chat': 'openai/gpt-5-mini',

      // 其他免費模型 → GPT-5 Mini (cost optimization)
      'google/gemini-2.0-flash-exp:free': 'openai/gpt-5-mini',
      'google/gemini-flash-1.5:free': 'openai/gpt-5-mini',
      'meta-llama/llama-3.2-3b-instruct:free': 'openai/gpt-5-mini',
      'qwen/qwen-2.5-7b-instruct:free': 'openai/gpt-5-mini',

      // GPT-5 → Gemini 2.5 Pro
      'openai/gpt-5': 'google/gemini-2.5-pro',
      'openai/gpt-4o': 'google/gemini-2.5-pro',
    };

    return fallbackMap[currentModel] || null;
  }

  async generateImage(prompt: string, options: {
    model: string;
    quality?: 'standard' | 'hd';
    size?: string;
  }): Promise<{ url: string; revisedPrompt?: string }> {
    try {
      // 使用 OpenAI 官方 API 處理 gpt-image-1 系列模型
      if (options.model.includes('gpt-image-1')) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY is not set');
        }

        // OpenAI 圖片 API 的 quality 參數：low, medium, high, auto
        // 'standard' → 'medium', 'hd' → 'high'
        const qualityMap: Record<string, string> = {
          'standard': 'medium',
          'hd': 'high',
        };
        const quality = qualityMap[options.quality || 'standard'] || 'medium';

        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: options.model,
            prompt: prompt,
            n: 1,
            size: options.size || '1024x1024',
            quality: quality,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
        }

        const data = await response.json();

        if (!data.data || !data.data[0]) {
          throw new Error('Invalid OpenAI image response structure');
        }

        const imageData = data.data[0];

        if (imageData.b64_json) {
          const base64Data = imageData.b64_json;
          const dataUrl = `data:image/png;base64,${base64Data}`;

          console.log('[AIClient] Generated image from b64_json (base64 length:', base64Data.length, ')');

          return {
            url: dataUrl,
            revisedPrompt: imageData.revised_prompt || prompt,
          };
        } else if (imageData.url) {
          console.log('[AIClient] Generated image from URL:', imageData.url);

          return {
            url: imageData.url,
            revisedPrompt: imageData.revised_prompt || prompt,
          };
        } else {
          throw new Error('No image URL or b64_json in OpenAI response');
        }
      }

      // 使用 OpenRouter 處理其他模型（如 dall-e-3）
      const response = await callOpenRouter({
        model: options.model,
        messages: [
          {
            role: 'user',
            content: `Generate an image with the following prompt: ${prompt}. Quality: ${options.quality || 'standard'}, Size: ${options.size || '1024x1024'}`,
          },
        ],
      });

      return {
        url: response.choices[0].message.content || '',
        revisedPrompt: prompt,
      };
    } catch (error: any) {
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }
}
