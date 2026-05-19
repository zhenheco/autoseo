import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FALLBACK_CHAINS } from "@/types/ai-models";

const routerState = vi.hoisted(() => ({
  complete: vi.fn(),
  constructor: vi.fn(),
}));

vi.mock("@/lib/ai/api-router", () => ({
  APIRouter: vi.fn(function APIRouter() {
    routerState.constructor();
    return {
      complete: routerState.complete,
    };
  }),
}));

describe("callShoplineAiSeoModel", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    routerState.complete.mockResolvedValue({
      content: '{"seoTitle":"Draft title"}',
      model: "deepseek-chat",
    });
  });

  it("routes AI SEO prompts through the simple fallback chain by default", async () => {
    const { callShoplineAiSeoModel } = await import("../ai-seo-call-model");

    const result = await callShoplineAiSeoModel("Generate JSON");

    expect(result).toEqual({
      text: '{"seoTitle":"Draft title"}',
      model: "deepseek-chat",
    });
    expect(routerState.constructor).toHaveBeenCalledTimes(1);
    expect(routerState.complete).toHaveBeenCalledWith({
      model: DEFAULT_FALLBACK_CHAINS.simple[0],
      apiProvider: "deepseek",
      prompt: "Generate JSON",
      temperature: 0.4,
      maxTokens: 600,
      responseFormat: "json",
    });
  });

  it("can route through the complex fallback chain when requested", async () => {
    const { callShoplineAiSeoModel } = await import("../ai-seo-call-model");

    await callShoplineAiSeoModel("Generate better JSON", {
      taskType: "complex",
    });

    expect(routerState.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: DEFAULT_FALLBACK_CHAINS.complex[0],
        apiProvider: "deepseek",
      }),
    );
  });
});
