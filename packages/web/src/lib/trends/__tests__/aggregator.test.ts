import { describe, expect, it, vi } from "vitest";
import {
  createTrendsAggregator,
  type GSCClient,
  type GoogleTrendsRssClient,
  type LLMSynthesizer,
  type PerplexityClient,
  type RawSignal,
  type TrendBrand,
} from "../aggregator";

function createPerplexityClient(signals: RawSignal[]): PerplexityClient {
  return {
    fetchWeeklyTrends: vi.fn(async () => signals),
  };
}

function createGscClient(signals: RawSignal[]): GSCClient {
  return {
    fetchTopQueries: vi.fn(async () => signals),
  };
}

function createGoogleTrendsClient(signals: RawSignal[]): GoogleTrendsRssClient {
  return {
    fetchWeeklyTrends: vi.fn(async () => signals),
  };
}

function createSynthesizer(signals: RawSignal[]): LLMSynthesizer {
  return {
    synthesize: vi.fn(async () =>
      signals.map((signal) => ({
        topic: signal.topic,
        source: signal.source,
        confidence: signal.confidence ?? 0.5,
        metadata: signal.metadata,
      })),
    ),
  };
}

const brand: TrendBrand = {
  id: "brand-1",
  keywords: ["AI SEO", "content automation"],
};

describe("createTrendsAggregator", () => {
  it("merges all three sources and returns synthesized signals sorted by confidence", async () => {
    const perplexity = [
      { topic: "AI SEO", source: "perplexity" as const, confidence: 0.62 },
    ];
    const gsc = [
      { topic: "seo automation", source: "gsc" as const, confidence: 0.74 },
    ];
    const googleTrends = [
      {
        topic: "google ai overview",
        source: "google_trends" as const,
        confidence: 0.91,
      },
    ];
    const synthesized = [
      googleTrends[0],
      gsc[0],
      perplexity[0],
    ] satisfies RawSignal[];
    const synthesizer = createSynthesizer(synthesized);

    const aggregator = createTrendsAggregator({
      perplexityClient: createPerplexityClient(perplexity),
      gscClient: createGscClient(gsc),
      googleTrendsClient: createGoogleTrendsClient(googleTrends),
      llmSynthesizer: synthesizer,
    });

    const result = await aggregator.fetchTrends(brand);

    expect(synthesizer.synthesize).toHaveBeenCalledWith(
      [...perplexity, ...gsc, ...googleTrends],
      brand,
    );
    expect(result.map((signal) => signal.topic)).toEqual([
      "google ai overview",
      "seo automation",
      "AI SEO",
    ]);
    expect(result.every((signal) => signal.confidence >= 0)).toBe(true);
    expect(result.every((signal) => signal.confidence <= 1)).toBe(true);
  });

  it("works without GSC when the user has not connected OAuth", async () => {
    const perplexityClient = createPerplexityClient([
      {
        topic: "content refresh workflows",
        source: "perplexity",
        confidence: 0.67,
      },
    ]);
    const googleTrendsClient = createGoogleTrendsClient([
      {
        topic: "ai search visibility",
        source: "google_trends",
        confidence: 0.82,
      },
    ]);
    const synthesizer = createSynthesizer([
      {
        topic: "ai search visibility",
        source: "google_trends",
        confidence: 0.82,
      },
      {
        topic: "content refresh workflows",
        source: "perplexity",
        confidence: 0.67,
      },
    ]);

    const aggregator = createTrendsAggregator({
      perplexityClient,
      gscClient: null,
      googleTrendsClient,
      llmSynthesizer: synthesizer,
    });

    const result = await aggregator.fetchTrends(brand);

    expect(result).toHaveLength(2);
    expect(synthesizer.synthesize).toHaveBeenCalledWith(
      [
        {
          topic: "content refresh workflows",
          source: "perplexity",
          confidence: 0.67,
        },
        {
          topic: "ai search visibility",
          source: "google_trends",
          confidence: 0.82,
        },
      ],
      brand,
    );
  });

  it("returns an empty array when all sources return no signals", async () => {
    const synthesizer = createSynthesizer([]);
    const aggregator = createTrendsAggregator({
      perplexityClient: createPerplexityClient([]),
      gscClient: createGscClient([]),
      googleTrendsClient: createGoogleTrendsClient([]),
      llmSynthesizer: synthesizer,
    });

    const result = await aggregator.fetchTrends(brand);

    expect(result).toEqual([]);
    expect(synthesizer.synthesize).not.toHaveBeenCalled();
  });

  it("lets the LLM synthesizer dedup equivalent topics into one signal", async () => {
    const synthesizer: LLMSynthesizer = {
      synthesize: vi.fn(async () => [
        {
          topic: "AI-powered SEO",
          source: "perplexity" as const,
          confidence: 0.88,
          metadata: {
            mergedTopics: ["AI SEO", "AI-powered SEO"],
            sources: ["perplexity", "google_trends"],
          },
        },
      ]),
    };
    const aggregator = createTrendsAggregator({
      perplexityClient: createPerplexityClient([
        { topic: "AI SEO", source: "perplexity", confidence: 0.7 },
      ]),
      gscClient: null,
      googleTrendsClient: createGoogleTrendsClient([
        {
          topic: "AI-powered SEO",
          source: "google_trends",
          confidence: 0.75,
        },
      ]),
      llmSynthesizer: synthesizer,
    });

    const result = await aggregator.fetchTrends(brand);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      topic: "AI-powered SEO",
      source: "perplexity",
      confidence: 0.88,
    });
    expect(result[0]?.confidence).toBeGreaterThanOrEqual(0);
    expect(result[0]?.confidence).toBeLessThanOrEqual(1);
  });
});
