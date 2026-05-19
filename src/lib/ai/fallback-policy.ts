import { DEFAULT_FALLBACK_CHAINS, type APIProvider } from "@/types/ai-models";

export type FallbackTier = "complex" | "simple";

export function detectProcessingTier(model: string): FallbackTier {
  if (
    model.includes("reasoner") ||
    model.includes("gpt-5") ||
    model.includes("gemini-2.5-pro")
  ) {
    return "complex";
  }

  return "simple";
}

export function getFallbackChain(
  model: string,
  fallbackChains: Record<string, string[]> = DEFAULT_FALLBACK_CHAINS,
): string[] {
  const tier = detectProcessingTier(model);
  return [...(fallbackChains[tier] || [])];
}

export function getNextFallbackModel(
  currentModel: string,
  chain: string[],
): string | null {
  const currentIndex = chain.indexOf(currentModel);
  if (currentIndex === -1 || currentIndex >= chain.length - 1) {
    return null;
  }

  return chain[currentIndex + 1];
}

export function isRetryableProviderError(error: unknown): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return (
    errorMessage.includes("429") ||
    errorMessage.includes("rate-limited") ||
    errorMessage.includes("Rate limit") ||
    errorMessage.includes("500") ||
    errorMessage.includes("502") ||
    errorMessage.includes("503")
  );
}

export function detectAIProvider(model: string): APIProvider {
  if (
    model.startsWith("deepseek") ||
    model === "deepseek-reasoner" ||
    model === "deepseek-chat"
  ) {
    return "deepseek";
  }

  if (
    model.startsWith("openai/") ||
    model.includes("gpt-") ||
    model.includes("dall-e") ||
    model.includes("gpt-image")
  ) {
    return "openai";
  }

  if (model.startsWith("google/") || model.startsWith("anthropic/")) {
    return "openrouter";
  }

  if (model.includes("gemini")) {
    return "gemini";
  }

  if (model.includes("sonar")) {
    return "perplexity";
  }

  return "deepseek";
}
