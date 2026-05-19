import { describe, expect, it } from "vitest";
import {
  detectAIProvider,
  detectProcessingTier,
  getFallbackChain,
  getNextFallbackModel,
  isRetryableProviderError,
} from "./fallback-policy";

describe("AI fallback policy", () => {
  it.each([
    ["deepseek-reasoner", "complex"],
    ["openai/gpt-5", "complex"],
    ["google/gemini-2.5-pro", "complex"],
    ["deepseek-chat", "simple"],
    ["openai/gpt-4o-mini", "simple"],
  ])("classifies %s as %s tier", (model, tier) => {
    expect(detectProcessingTier(model)).toBe(tier);
  });

  it.each([
    ["deepseek-chat", "deepseek"],
    ["openai/gpt-4o-mini", "openai"],
    ["google/gemini-2.5-flash", "openrouter"],
    ["anthropic/claude-sonnet-4.5", "openrouter"],
    ["sonar", "perplexity"],
    ["gemini-2.0-flash", "gemini"],
  ])("detects %s provider as %s", (model, provider) => {
    expect(detectAIProvider(model)).toBe(provider);
  });

  it("returns the configured fallback chain for a model tier", () => {
    expect(getFallbackChain("deepseek-reasoner")).toEqual([
      "deepseek-reasoner",
      "openai/gpt-5",
      "openai/gpt-4o",
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "anthropic/claude-sonnet-4.5",
    ]);
  });

  it("returns the next fallback model from the chain", () => {
    expect(
      getNextFallbackModel(
        "openai/gpt-5",
        getFallbackChain("deepseek-reasoner"),
      ),
    ).toBe("openai/gpt-4o");
  });

  it("returns null when the current model is missing or last in the chain", () => {
    expect(getNextFallbackModel("missing-model", ["deepseek-chat"])).toBeNull();
    expect(getNextFallbackModel("deepseek-chat", ["deepseek-chat"])).toBeNull();
  });

  it.each(["429 rate-limited", "Rate limit exceeded", "500", "502", "503"])(
    "treats %s as retryable",
    (message) => {
      expect(isRetryableProviderError(new Error(message))).toBe(true);
    },
  );

  it("does not treat validation errors as retryable", () => {
    expect(isRetryableProviderError(new Error("invalid prompt"))).toBe(false);
  });
});
