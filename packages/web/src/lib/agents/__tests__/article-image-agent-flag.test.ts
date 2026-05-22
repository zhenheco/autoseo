import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ArticleImageAgent } from "../article-image-agent";

const aiConfig: import("@/types/agents").AIClientConfig = {
  openaiApiKey: "test-key",
};

const context = {
  userId: "test-user",
  companyId: "test-company",
} as never;

const inputBase = {
  title: "Test",
  outline: {
    mainSections: [
      { heading: "Intro" },
      { heading: "Body" },
      { heading: "Conclusion" },
    ],
  } as never,
  model: "test-model",
  quality: "medium" as const,
  size: "1024x1024",
};

describe("ArticleImageAgent IMAGE_GENERATION_ENABLED flag", () => {
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
    const agent = new ArticleImageAgent(aiConfig, context);
    // @ts-expect-error access protected method for testing
    const genSpy = vi.spyOn(agent, "generateContentImageWithRetry");

    const result = await agent.execute(inputBase);

    expect(genSpy).not.toHaveBeenCalled();
    expect(result.images).toEqual([]);
    expect(result.executionInfo.skippedReason).toBe("feature_disabled");
    expect(result.executionInfo.totalCost).toBe(0);
  });

  it("short-circuits when flag is 'false'", async () => {
    process.env.IMAGE_GENERATION_ENABLED = "false";
    const agent = new ArticleImageAgent(aiConfig, context);
    // @ts-expect-error access protected method for testing
    const genSpy = vi.spyOn(agent, "generateContentImageWithRetry");

    const result = await agent.execute(inputBase);

    expect(genSpy).not.toHaveBeenCalled();
    expect(result.images).toEqual([]);
  });

  it("attempts generation when flag is 'true'", async () => {
    process.env.IMAGE_GENERATION_ENABLED = "true";
    const agent = new ArticleImageAgent(aiConfig, context);
    const genSpy = vi
      // @ts-expect-error access protected method for testing
      .spyOn(agent, "generateContentImageWithRetry")
      .mockResolvedValue({
        url: "https://example.com/img.png",
        prompt: "stub",
        revisedPrompt: null,
        model: "test-model",
        size: "1024x1024",
        cost: 0.005,
        sectionIndex: 1,
      } as never);

    const result = await agent.execute(inputBase);

    expect(genSpy).toHaveBeenCalled();
    expect(result.images.length).toBeGreaterThan(0);
  });
});
