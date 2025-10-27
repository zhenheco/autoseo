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

  async complete(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const messages = this.formatMessages(prompt);

    try {
      const response = await callOpenRouter({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        response_format: options.format === 'json' ? { type: 'json_object' } : undefined,
      });

      return {
        content: response.choices[0].message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        model: response.model,
      };
    } catch (error: any) {
      throw new Error(`AI completion failed: ${error.message}`);
    }
  }

  private formatMessages(prompt: string | AIMessage[]): AIMessage[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }
    return prompt;
  }

  async generateImage(prompt: string, options: {
    model: string;
    quality?: 'standard' | 'hd';
    size?: string;
  }): Promise<{ url: string; revisedPrompt?: string }> {
    try {
      const response = await callOpenRouter({
        model: options.model,
        messages: [
          {
            role: 'user',
            content: `Generate an image with the following prompt: ${prompt}. Quality: ${options.quality || 'standard'}, Size: ${options.size || '1024x1024'}`,
          },
        ],
        temperature: 0.7,
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
