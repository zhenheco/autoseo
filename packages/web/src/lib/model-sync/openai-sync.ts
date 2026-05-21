import OpenAI from "openai";

interface ModelPricing {
  input?: number;
  output?: number;
  currency: string;
  per: number | string;
  standard_1024?: number;
  standard_1792?: number;
  hd_1024?: number;
  hd_1792?: number;
  "256"?: number;
  "512"?: number;
  "1024"?: number;
}

interface ModelInfo {
  provider: "openai";
  modelId: string;
  modelName: string;
  modelType: "text" | "image";
  description: string;
  capabilities: string[];
  pricing: ModelPricing;
  contextWindow?: number;
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsJsonMode?: boolean;
  supportsFunctionCalling?: boolean;
  imageSizes?: string[];
  imageQualityOptions?: string[];
  tags: string[];
  version?: string;
}

export class OpenAIModelSync {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async fetchAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    try {
      const response = await this.openai.models.list();
      const openaiModels = response.data;

      for (const model of openaiModels) {
        const modelInfo = this.parseOpenAIModel(model);
        if (modelInfo) {
          models.push(modelInfo);
        }
      }
    } catch (error) {
      console.error("Failed to fetch OpenAI models:", error);
    }

    return models;
  }

  private parseOpenAIModel(model: { id: string }): ModelInfo | null {
    const modelId = model.id;

    if (modelId.startsWith("gpt-4")) {
      return this.parseGPT4Model(modelId);
    } else if (modelId.startsWith("gpt-3.5")) {
      return this.parseGPT35Model(modelId);
    } else if (modelId.startsWith("dall-e")) {
      return this.parseDallEModel(modelId);
    } else if (modelId.includes("chatgpt") && modelId.includes("image")) {
      return this.parseChatGPTImageModel(modelId);
    }

    return null;
  }

  private parseGPT4Model(modelId: string): ModelInfo {
    const isTurbo = modelId.includes("turbo");
    const isVision = modelId.includes("vision");

    return {
      provider: "openai",
      modelId,
      modelName: this.formatModelName(modelId),
      modelType: "text",
      description: this.generateDescription(modelId),
      capabilities: this.getCapabilities(modelId),
      pricing: this.getPricing(modelId),
      contextWindow: this.getContextWindow(modelId),
      maxTokens: 4096,
      supportsStreaming: true,
      supportsJsonMode: isTurbo,
      supportsFunctionCalling: true,
      tags: this.getTags(modelId),
      version: this.extractVersion(modelId),
    };
  }

  private parseGPT35Model(modelId: string): ModelInfo {
    return {
      provider: "openai",
      modelId,
      modelName: this.formatModelName(modelId),
      modelType: "text",
      description: "快速且經濟的模型，適合一般任務",
      capabilities: ["general", "fast", "economical"],
      pricing: { input: 0.0005, output: 0.0015, currency: "USD", per: 1000 },
      contextWindow: 16385,
      maxTokens: 4096,
      supportsStreaming: true,
      supportsJsonMode: true,
      supportsFunctionCalling: true,
      tags: ["economical", "fast"],
      version: this.extractVersion(modelId),
    };
  }

  private parseDallEModel(modelId: string): ModelInfo {
    const isDallE3 = modelId.includes("dall-e-3");

    return {
      provider: "openai",
      modelId,
      modelName: this.formatModelName(modelId),
      modelType: "image",
      description: isDallE3
        ? "最新的 DALL-E 模型，圖片品質最佳"
        : "經濟實惠的圖片生成模型",
      capabilities: isDallE3
        ? ["high-quality", "detailed", "creative"]
        : ["economical", "general"],
      pricing: isDallE3
        ? {
            standard_1024: 0.04,
            standard_1792: 0.08,
            hd_1024: 0.08,
            hd_1792: 0.12,
            currency: "USD",
            per: "image",
          }
        : {
            "256": 0.016,
            "512": 0.018,
            "1024": 0.02,
            currency: "USD",
            per: "image",
          },
      imageSizes: isDallE3
        ? ["1024x1024", "1024x1792", "1792x1024"]
        : ["256x256", "512x512", "1024x1024"],
      imageQualityOptions: isDallE3 ? ["standard", "hd"] : ["standard"],
      tags: isDallE3 ? ["recommended", "high-quality"] : ["economical"],
    };
  }

  private parseChatGPTImageModel(modelId: string): ModelInfo {
    return {
      provider: "openai",
      modelId,
      modelName: "ChatGPT Image Mini",
      modelType: "image",
      description: "輕量級圖片生成模型",
      capabilities: ["fast", "economical"],
      pricing: { "1024": 0.015, currency: "USD", per: "image" },
      imageSizes: ["1024x1024"],
      imageQualityOptions: ["standard"],
      tags: ["economical", "fast"],
    };
  }

  private formatModelName(modelId: string): string {
    return modelId
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private generateDescription(modelId: string): string {
    if (modelId.includes("turbo")) {
      return "最新的 GPT-4 Turbo 模型，效能優異且成本更低";
    }
    if (modelId.includes("vision")) {
      return "支援視覺輸入的 GPT-4 模型";
    }
    return "強大的 GPT-4 模型，適合複雜任務";
  }

  private getCapabilities(modelId: string): string[] {
    const capabilities = ["reasoning", "analysis", "creativity", "coding"];

    if (modelId.includes("vision")) {
      capabilities.push("vision");
    }

    return capabilities;
  }

  private getPricing(modelId: string): ModelPricing {
    if (modelId.includes("gpt-4-turbo")) {
      return { input: 0.01, output: 0.03, currency: "USD", per: 1000 };
    }
    if (modelId.includes("gpt-4")) {
      return { input: 0.03, output: 0.06, currency: "USD", per: 1000 };
    }
    return { input: 0.01, output: 0.03, currency: "USD", per: 1000 };
  }

  private getContextWindow(modelId: string): number {
    if (modelId.includes("turbo")) {
      return 128000;
    }
    if (modelId.includes("32k")) {
      return 32768;
    }
    return 8192;
  }

  private getTags(modelId: string): string[] {
    const tags: string[] = [];

    if (modelId.includes("turbo")) {
      tags.push("recommended", "latest");
    }
    if (modelId.includes("preview")) {
      tags.push("preview");
    }

    return tags;
  }

  private extractVersion(modelId: string): string | undefined {
    const match = modelId.match(/\d{4}/);
    return match ? match[0] : undefined;
  }
}
