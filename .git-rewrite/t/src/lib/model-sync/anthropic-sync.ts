interface ModelInfo {
  provider: 'anthropic';
  modelId: string;
  modelName: string;
  modelType: 'text';
  description: string;
  capabilities: string[];
  pricing: any;
  contextWindow: number;
  maxTokens: number;
  supportsStreaming: boolean;
  tags: string[];
  version: string;
}

export class AnthropicModelSync {
  private knownModels = [
    {
      modelId: 'claude-3-opus-20240229',
      modelName: 'Claude 3 Opus',
      description: 'Claude 3 最強大版本，適合複雜分析和長文寫作',
      capabilities: ['reasoning', 'analysis', 'creativity', 'long-form'],
      pricing: { input: 0.015, output: 0.075, currency: 'USD', per: 1000 },
      contextWindow: 200000,
      maxTokens: 4096,
      tags: ['powerful', 'long-context'],
      version: '3.0',
    },
    {
      modelId: 'claude-3-sonnet-20240229',
      modelName: 'Claude 3 Sonnet',
      description: 'Claude 3 平衡版本，效能與成本兼顧',
      capabilities: ['balanced', 'analysis', 'creativity'],
      pricing: { input: 0.003, output: 0.015, currency: 'USD', per: 1000 },
      contextWindow: 200000,
      maxTokens: 4096,
      tags: ['balanced', 'recommended'],
      version: '3.0',
    },
    {
      modelId: 'claude-3-haiku-20240307',
      modelName: 'Claude 3 Haiku',
      description: 'Claude 3 快速版本，適合簡單任務',
      capabilities: ['fast', 'economical'],
      pricing: { input: 0.00025, output: 0.00125, currency: 'USD', per: 1000 },
      contextWindow: 200000,
      maxTokens: 4096,
      tags: ['fast', 'economical'],
      version: '3.0',
    },
    {
      modelId: 'claude-3-5-sonnet-20241022',
      modelName: 'Claude 3.5 Sonnet',
      description: 'Claude 3.5 最新版本，效能大幅提升',
      capabilities: ['balanced', 'analysis', 'creativity', 'coding'],
      pricing: { input: 0.003, output: 0.015, currency: 'USD', per: 1000 },
      contextWindow: 200000,
      maxTokens: 8192,
      tags: ['latest', 'recommended', 'powerful'],
      version: '3.5',
    },
  ];

  async fetchAvailableModels(): Promise<ModelInfo[]> {
    return this.knownModels.map((model) => ({
      provider: 'anthropic' as const,
      modelType: 'text' as const,
      supportsStreaming: true,
      ...model,
    }));
  }

  async checkForNewModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch('https://docs.anthropic.com/claude/docs/models-overview');
      const html = await response.text();

      const newModels: ModelInfo[] = [];
      const modelPattern = /claude-(\d+(?:\.\d+)?)-(\w+)-(\d{8})/g;
      let match;

      while ((match = modelPattern.exec(html)) !== null) {
        const modelId = match[0];

        if (!this.knownModels.find((m) => m.modelId === modelId)) {
          const version = match[1];
          const variant = match[2];

          newModels.push({
            provider: 'anthropic',
            modelId,
            modelName: `Claude ${version} ${this.capitalizeVariant(variant)}`,
            modelType: 'text',
            description: `新發現的 Claude ${version} ${variant} 模型`,
            capabilities: this.inferCapabilities(variant),
            pricing: this.estimatePricing(variant),
            contextWindow: 200000,
            maxTokens: version.startsWith('3.5') ? 8192 : 4096,
            supportsStreaming: true,
            tags: ['new', 'unverified'],
            version,
          });
        }
      }

      return newModels;
    } catch (error) {
      console.error('Failed to check for new Anthropic models:', error);
      return [];
    }
  }

  private capitalizeVariant(variant: string): string {
    return variant.charAt(0).toUpperCase() + variant.slice(1);
  }

  private inferCapabilities(variant: string): string[] {
    switch (variant.toLowerCase()) {
      case 'opus':
        return ['reasoning', 'analysis', 'creativity', 'long-form'];
      case 'sonnet':
        return ['balanced', 'analysis', 'creativity'];
      case 'haiku':
        return ['fast', 'economical'];
      default:
        return ['general'];
    }
  }

  private estimatePricing(variant: string): any {
    switch (variant.toLowerCase()) {
      case 'opus':
        return { input: 0.015, output: 0.075, currency: 'USD', per: 1000 };
      case 'sonnet':
        return { input: 0.003, output: 0.015, currency: 'USD', per: 1000 };
      case 'haiku':
        return { input: 0.00025, output: 0.00125, currency: 'USD', per: 1000 };
      default:
        return { input: 0.003, output: 0.015, currency: 'USD', per: 1000 };
    }
  }
}
