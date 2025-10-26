import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type {
  AIClientConfig,
  AICompletionOptions,
  AICompletionResponse,
  AIMessage,
} from '@/types/agents';

export class AIClient {
  private openai?: OpenAI;
  private anthropic?: Anthropic;
  private config: AIClientConfig;

  constructor(config: AIClientConfig) {
    this.config = config;

    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }

    if (config.anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: config.anthropicApiKey });
    }
  }

  async complete(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    const provider = this.getProvider(options.model);

    switch (provider) {
      case 'openai':
        return this.completeOpenAI(prompt, options);
      case 'anthropic':
        return this.completeAnthropic(prompt, options);
      case 'deepseek':
        return this.completeDeepSeek(prompt, options);
      case 'perplexity':
        return this.completePerplexity(prompt, options);
      default:
        throw new Error(`Unsupported model: ${options.model}`);
    }
  }

  private async completeOpenAI(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const messages = this.formatMessages(prompt);

    const response = await this.openai.chat.completions.create({
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
  }

  private async completeAnthropic(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic API key not configured');
    }

    const messages = this.formatMessages(prompt);
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await this.anthropic.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.7,
      system: systemMessage?.content,
      messages: userMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    });

    const content = response.content[0];
    const textContent = content.type === 'text' ? content.text : '';

    return {
      content: textContent,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
    };
  }

  private async completeDeepSeek(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.config.deepseekApiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    const messages = this.formatMessages(prompt);

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }

  private async completePerplexity(
    prompt: string | AIMessage[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    if (!this.config.perplexityApiKey) {
      throw new Error('Perplexity API key not configured');
    }

    const messages = this.formatMessages(prompt);

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      },
      model: data.model,
    };
  }

  private formatMessages(prompt: string | AIMessage[]): AIMessage[] {
    if (typeof prompt === 'string') {
      return [{ role: 'user', content: prompt }];
    }
    return prompt;
  }

  private getProvider(model: string): 'openai' | 'anthropic' | 'deepseek' | 'perplexity' {
    if (model.startsWith('gpt-') || model.startsWith('dall-e-') || model.includes('chatgpt')) {
      return 'openai';
    }
    if (model.startsWith('claude-')) {
      return 'anthropic';
    }
    if (model.startsWith('deepseek-')) {
      return 'deepseek';
    }
    if (model.startsWith('perplexity-') || model.startsWith('sonar')) {
      return 'perplexity';
    }
    return 'openai';
  }

  async generateImage(prompt: string, options: {
    model: string;
    quality?: 'standard' | 'hd';
    size?: string;
  }): Promise<{ url: string; revisedPrompt?: string }> {
    const provider = this.getImageProvider(options.model);

    switch (provider) {
      case 'openai':
        return this.generateImageOpenAI(prompt, options);
      case 'nano':
        return this.generateImageNano(prompt, options);
      default:
        throw new Error(`Unsupported image model: ${options.model}`);
    }
  }

  private async generateImageOpenAI(prompt: string, options: {
    model: string;
    quality?: 'standard' | 'hd';
    size?: string;
  }): Promise<{ url: string; revisedPrompt?: string }> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await this.openai.images.generate({
      model: options.model,
      prompt,
      n: 1,
      size: (options.size as any) || '1024x1024',
      quality: options.quality || 'standard',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image generated');
    }

    return {
      url: response.data[0].url!,
      revisedPrompt: response.data[0].revised_prompt,
    };
  }

  private async generateImageNano(prompt: string, options: {
    model: string;
    quality?: 'standard' | 'hd';
    size?: string;
  }): Promise<{ url: string }> {
    const apiKey = process.env.NANO_API_KEY;
    if (!apiKey) {
      throw new Error('Nano API key not configured');
    }

    const response = await fetch('https://api.nano.com/v1/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        prompt,
        size: options.size || '1024x1024',
        quality: options.quality === 'hd' ? 'high' : 'standard',
      }),
    });

    if (!response.ok) {
      throw new Error(`Nano API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { url: data.data[0].url };
  }

  private getImageProvider(model: string): 'openai' | 'nano' {
    if (model.startsWith('dall-e-') || model === 'chatgpt-image-mini') {
      return 'openai';
    }
    if (model === 'nano-banana') {
      return 'nano';
    }
    return 'openai';
  }
}
