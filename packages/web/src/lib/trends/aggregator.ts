export type TrendSignalSource =
  | "perplexity"
  | "gsc"
  | "google_trends"
  | "manual";

export interface TrendSignal {
  topic: string;
  source: TrendSignalSource;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface RawSignal {
  topic: string;
  source: TrendSignalSource;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface TrendBrand {
  id: string;
  keywords: string[];
  industry?: string;
  geography?: string;
  gscSiteUrl?: string;
}

export interface PerplexityClient {
  fetchWeeklyTrends(brand: TrendBrand): Promise<RawSignal[]>;
}

export interface GSCClient {
  fetchTopQueries(brand: TrendBrand): Promise<RawSignal[]>;
}

export interface GoogleTrendsRssClient {
  fetchWeeklyTrends(brand: TrendBrand): Promise<RawSignal[]>;
}

export interface LLMSynthesizer {
  synthesize(signals: RawSignal[], brand: TrendBrand): Promise<TrendSignal[]>;
}

export interface TrendsAggregator {
  fetchTrends(brand: {
    id: string;
    keywords: string[];
  }): Promise<TrendSignal[]>;
}

function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0.5;
  return Math.min(1, Math.max(0, confidence));
}

function normalizeRawSignal(signal: RawSignal): RawSignal | null {
  const topic = signal.topic.trim();
  if (!topic) return null;

  return {
    ...signal,
    topic,
    confidence:
      signal.confidence === undefined
        ? undefined
        : clampConfidence(signal.confidence),
  };
}

function normalizeTrendSignal(signal: TrendSignal): TrendSignal | null {
  const topic = signal.topic.trim();
  if (!topic) return null;

  return {
    ...signal,
    topic,
    confidence: clampConfidence(signal.confidence),
  };
}

export function createTrendsAggregator(deps: {
  perplexityClient: PerplexityClient;
  gscClient?: GSCClient | null;
  googleTrendsClient: GoogleTrendsRssClient;
  llmSynthesizer: LLMSynthesizer;
}): TrendsAggregator {
  return {
    async fetchTrends(brand) {
      const [perplexitySignals, gscSignals, googleTrendsSignals] =
        await Promise.all([
          deps.perplexityClient.fetchWeeklyTrends(brand),
          deps.gscClient?.fetchTopQueries(brand) ?? Promise.resolve([]),
          deps.googleTrendsClient.fetchWeeklyTrends(brand),
        ]);

      const rawSignals = [
        ...perplexitySignals,
        ...gscSignals,
        ...googleTrendsSignals,
      ].flatMap((signal) => {
        const normalized = normalizeRawSignal(signal);
        return normalized ? [normalized] : [];
      });

      if (rawSignals.length === 0) {
        return [];
      }

      return (await deps.llmSynthesizer.synthesize(rawSignals, brand))
        .flatMap((signal) => {
          const normalized = normalizeTrendSignal(signal);
          return normalized ? [normalized] : [];
        })
        .sort((a, b) => b.confidence - a.confidence);
    },
  };
}
