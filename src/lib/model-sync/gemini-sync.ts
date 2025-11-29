interface ModelPricing {
  input: number;
  output: number;
  currency: string;
  per: number;
}

interface ModelInfo {
  provider: "google";
  modelId: string;
  modelName: string;
  modelType: "text";
  description: string;
  capabilities: string[];
  pricing: ModelPricing;
  contextWindow: number;
  maxTokens: number;
  supportsStreaming: boolean;
  tags: string[];
  version: string;
}

export class GeminiModelSync {
  private knownModels = [
    {
      modelId: "gemini-1.5-pro",
      modelName: "Gemini 1.5 Pro",
      description: "Google 最強大的多模態模型，支援長上下文",
      capabilities: ["reasoning", "multimodal", "long-context", "coding"],
      pricing: { input: 0.00125, output: 0.005, currency: "USD", per: 1000 },
      contextWindow: 1000000,
      maxTokens: 8192,
      tags: ["powerful", "long-context", "multimodal"],
      version: "1.5",
    },
    {
      modelId: "gemini-1.5-flash",
      modelName: "Gemini 1.5 Flash",
      description: "Google 快速版本，適合高頻率任務",
      capabilities: ["fast", "economical", "multimodal"],
      pricing: { input: 0.000075, output: 0.0003, currency: "USD", per: 1000 },
      contextWindow: 1000000,
      maxTokens: 8192,
      tags: ["fast", "economical", "recommended"],
      version: "1.5",
    },
    {
      modelId: "gemini-pro",
      modelName: "Gemini Pro",
      description: "Google 平衡版本",
      capabilities: ["balanced", "general"],
      pricing: { input: 0.0005, output: 0.0015, currency: "USD", per: 1000 },
      contextWindow: 32000,
      maxTokens: 8192,
      tags: ["balanced"],
      version: "1.0",
    },
  ];

  async fetchAvailableModels(): Promise<ModelInfo[]> {
    return this.knownModels.map((model) => ({
      provider: "google" as const,
      modelType: "text" as const,
      supportsStreaming: true,
      ...model,
    }));
  }
}
