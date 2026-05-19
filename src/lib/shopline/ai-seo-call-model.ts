import { APIRouter } from "@/lib/ai/api-router";
import { detectAIProvider } from "@/lib/ai/fallback-policy";
import { DEFAULT_FALLBACK_CHAINS } from "@/types/ai-models";

export async function callShoplineAiSeoModel(
  prompt: string,
  opts?: { taskType?: "simple" | "complex" },
): Promise<{ text: string; model: string }> {
  const taskType = opts?.taskType ?? "simple";
  const model = DEFAULT_FALLBACK_CHAINS[taskType][0];
  const router = new APIRouter();
  const response = await router.complete({
    model,
    apiProvider: detectAIProvider(model),
    prompt,
    temperature: 0.4,
    maxTokens: 600,
    responseFormat: "json",
  });

  return {
    text: response.content,
    model: response.model,
  };
}
