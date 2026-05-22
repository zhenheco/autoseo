import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { FeaturedImageAgent } from "../featured-image-agent";

const aiConfig: import("@/types/agents").AIClientConfig = {
  openaiApiKey: "test-key",
};

const context = {
  userId: "test-user",
  companyId: "test-company",
} as never;

describe("FeaturedImageAgent IMAGE_GENERATION_ENABLED flag", () => {
  const originalEnv = process.env.IMAGE_GENERATION_ENABLED;

  beforeEach(() => {
    delete process.env.IMAGE_GENERATION_ENABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.IMAGE_GENERATION_ENABLED;
    else process.env.IMAGE_GENERATION_ENABLED = originalEnv;
    vi.restoreAllMocks();
  });

  it("short-circuits when flag is unset", async () => {
    const agent = new FeaturedImageAgent(aiConfig, context);
    // @ts-expect-error access protected method for testing
    const generateSpy = vi.spyOn(agent, "generateFeaturedImage");

    const result = await agent.execute({
      title: "Test",
      model: "test-model",
      quality: "medium",
      size: "1024x1024",
      articleContext: { outline: [], mainTopics: [], keywords: [] },
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(result.image).toBeNull();
    expect(result.executionInfo.skippedReason).toBe("feature_disabled");
    expect(result.executionInfo.cost).toBe(0);
  });

  it("short-circuits when flag is 'false'", async () => {
    process.env.IMAGE_GENERATION_ENABLED = "false";
    const agent = new FeaturedImageAgent(aiConfig, context);
    // @ts-expect-error access protected method for testing
    const generateSpy = vi.spyOn(agent, "generateFeaturedImage");

    const result = await agent.execute({
      title: "Test",
      model: "test-model",
      quality: "medium",
      size: "1024x1024",
      articleContext: { outline: [], mainTopics: [], keywords: [] },
    });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(result.image).toBeNull();
    expect(result.executionInfo.skippedReason).toBe("feature_disabled");
  });

  it("attempts generation when flag is 'true' (smoke; we stub generator)", async () => {
    process.env.IMAGE_GENERATION_ENABLED = "true";
    const agent = new FeaturedImageAgent(aiConfig, context);
    const generateSpy = vi
      // @ts-expect-error access protected method for testing
      .spyOn(agent, "generateFeaturedImage")
      .mockResolvedValue({
        url: "https://example.com/img.png",
        prompt: "stub",
        revisedPrompt: null,
        model: "test-model",
        size: "1024x1024",
        cost: 0.005,
      } as never);

    const result = await agent.execute({
      title: "Test",
      model: "test-model",
      quality: "medium",
      size: "1024x1024",
      articleContext: { outline: [], mainTopics: [], keywords: [] },
    });

    expect(generateSpy).toHaveBeenCalledOnce();
    expect(result.image).not.toBeNull();
    expect(result.executionInfo.skippedReason).toBeUndefined();
  });
});
