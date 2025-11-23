import { AIClient } from '@/lib/ai/ai-client';
import type { AIClientConfig, AICompletionOptions, AICompletionResponse } from '@/types/agents';

export interface AgentExecutionContext {
  websiteId: string;
  companyId: string;
  articleJobId?: string;
}

export interface AgentExecutionInfo {
  agentName: string;
  model?: string;
  executionTime: number;
  tokenUsage: {
    input: number;
    output: number;
    charged?: number;
  };
}

export interface AgentLogEntry {
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: Date;
  data?: any;
}

export abstract class BaseAgent<TInput, TOutput> {
  protected aiClient: AIClient;
  protected context: AgentExecutionContext;
  protected logs: AgentLogEntry[] = [];
  protected startTime?: number;
  protected totalTokensUsed = { input: 0, output: 0, charged: 0 };

  constructor(aiConfig: AIClientConfig, context: AgentExecutionContext) {
    this.aiClient = new AIClient(aiConfig);
    this.context = context;
  }

  abstract get agentName(): string;

  async execute(input: TInput): Promise<TOutput> {
    this.startTime = Date.now();
    this.logs = [];
    this.totalTokensUsed = { input: 0, output: 0, charged: 0 };

    this.log('info', `${this.agentName} started`, { input });

    try {
      const result = await this.process(input);

      const executionTime = Date.now() - this.startTime;
      this.log('info', `${this.agentName} completed`, {
        executionTime,
        tokenUsage: this.totalTokensUsed,
      });

      return result;
    } catch (error) {
      this.log('error', `${this.agentName} failed`, { error });
      throw error;
    }
  }

  protected abstract process(input: TInput): Promise<TOutput>;

  protected async complete(
    prompt: string | any[],
    options: AICompletionOptions
  ): Promise<AICompletionResponse> {
    try {
      const response = await this.aiClient.complete(prompt, options);

      this.totalTokensUsed.input += response.usage.promptTokens;
      this.totalTokensUsed.output += response.usage.completionTokens;
      this.totalTokensUsed.charged += response.usage.promptTokens + response.usage.completionTokens;

      this.log('info', 'AI completion successful', {
        model: response.model,
        tokens: response.usage,
      });

      return response;
    } catch (error) {
      this.log('error', 'AI completion failed', { error, options });
      throw error;
    }
  }

  protected async generateImage(
    prompt: string,
    options: {
      model: string;
      quality?: 'low' | 'medium' | 'high' | 'auto';
      size?: string;
    }
  ): Promise<{ url: string; revisedPrompt?: string }> {
    try {
      const result = await this.aiClient.generateImage(prompt, options);

      this.log('info', 'Image generation successful', {
        model: options.model,
        prompt: prompt.substring(0, 100),
      });

      return result;
    } catch (error) {
      this.log('error', 'Image generation failed', { error, options });
      throw error;
    }
  }

  protected log(level: AgentLogEntry['level'], message: string, data?: any): void {
    const entry: AgentLogEntry = {
      level,
      message,
      timestamp: new Date(),
      data,
    };
    this.logs.push(entry);

    if (level === 'error') {
      console.error(`[${this.agentName}]`, message, data);
    } else if (level === 'warning') {
      console.warn(`[${this.agentName}]`, message, data);
    } else {
      console.log(`[${this.agentName}]`, message, data);
    }
  }

  getLogs(): AgentLogEntry[] {
    return this.logs;
  }

  getExecutionInfo(model?: string): AgentExecutionInfo {
    return {
      agentName: this.agentName,
      model,
      executionTime: this.startTime ? Date.now() - this.startTime : 0,
      tokenUsage: this.totalTokensUsed,
    };
  }
}
