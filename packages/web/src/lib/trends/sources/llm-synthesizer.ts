import type {
  LLMSynthesizer,
  RawSignal,
  TrendBrand,
  TrendSignal,
  TrendSignalSource,
} from "../aggregator";

type FetchLike = typeof fetch;

type ProviderMode = "gemini" | "openai-compatible";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export interface LLMSynthesizerConfig {
  apiKey: string;
  endpoint: string;
  cfAigToken?: string;
  model?: "gemini-2.0-flash" | "deepseek-chat" | string;
  provider?: ProviderMode;
  fetchImpl?: FetchLike;
}

const VALID_SOURCES = new Set<TrendSignalSource>([
  "perplexity",
  "gsc",
  "google_trends",
  "manual",
]);

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function clampConfidence(confidence: unknown): number {
  const value = typeof confidence === "number" ? confidence : 0.5;
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

function buildProviderHeaders(config: LLMSynthesizerConfig): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if ((config.provider ?? inferProvider(config.model)) === "gemini") {
    headers["x-goog-api-key"] = config.apiKey;
  } else {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  if (config.cfAigToken) {
    headers["cf-aig-authorization"] = `Bearer ${config.cfAigToken}`;
  }

  return headers;
}

function inferProvider(model = "gemini-2.0-flash"): ProviderMode {
  return model.startsWith("gemini") ? "gemini" : "openai-compatible";
}

function buildGeminiUrl(endpoint: string, model: string): string {
  const base = trimEndpoint(endpoint);
  if (base.endsWith(":generateContent")) return base;
  if (base.includes("/models/")) return `${base}:generateContent`;
  return `${base}/v1beta/models/${model}:generateContent`;
}

function buildChatCompletionsUrl(endpoint: string): string {
  const base = trimEndpoint(endpoint);
  return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
}

function extractJsonArray(content: string): unknown[] {
  const stripped = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function canonicalTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/\bpowered\b/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fallbackDedup(signals: RawSignal[]): TrendSignal[] {
  const groups = new Map<string, RawSignal[]>();

  for (const signal of signals) {
    const key = canonicalTopic(signal.topic);
    groups.set(key, [...(groups.get(key) ?? []), signal]);
  }

  return [...groups.values()].map((group) => {
    const sorted = [...group].sort(
      (a, b) => (b.confidence ?? 0.5) - (a.confidence ?? 0.5),
    );
    const primary = sorted[0];

    return {
      topic: primary?.topic ?? "",
      source: primary?.source ?? "manual",
      confidence: clampConfidence(
        Math.min(
          1,
          Math.max(...group.map((signal) => signal.confidence ?? 0.5)) +
            (group.length - 1) * 0.05,
        ),
      ),
      metadata: {
        mergedTopics: group.map((signal) => signal.topic),
        sources: [...new Set(group.map((signal) => signal.source))],
      },
    };
  });
}

function parseTrendSignals(content: string, rawSignals: RawSignal[]) {
  const parsed = extractJsonArray(content);
  if (parsed.length === 0) {
    return fallbackDedup(rawSignals);
  }

  return parsed.flatMap((item): TrendSignal[] => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.topic !== "string") return [];

    const source =
      typeof record.source === "string" &&
      VALID_SOURCES.has(record.source as TrendSignalSource)
        ? (record.source as TrendSignalSource)
        : (rawSignals.find((signal) => signal.topic === record.topic)?.source ??
          "manual");

    return [
      {
        topic: record.topic,
        source,
        confidence: clampConfidence(record.confidence),
        metadata: {
          mergedTopics: record.mergedTopics,
          sources: record.sources,
          rationale: record.rationale,
        },
      },
    ];
  });
}

function buildPrompt(signals: RawSignal[], brand: TrendBrand): string {
  return [
    "Deduplicate weekly SEO topic trend signals for one brand.",
    "Merge topics that mean the same thing, for example AI SEO and AI-powered SEO.",
    "Return JSON only as an array of objects with topic, source, confidence, mergedTopics, sources, and rationale.",
    "Use source as the strongest source among perplexity, gsc, google_trends, manual.",
    "Confidence must be a number from 0 to 1.",
    "",
    `Brand keywords: ${brand.keywords.join(", ")}`,
    `Raw signals: ${JSON.stringify(signals)}`,
  ].join("\n");
}

export class AiGatewayLLMSynthesizer implements LLMSynthesizer {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly provider: ProviderMode;
  private readonly fetchImpl: FetchLike;
  private readonly headers: HeadersInit;

  constructor(config: LLMSynthesizerConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = config.endpoint;
    this.model = config.model ?? "gemini-2.0-flash";
    this.provider = config.provider ?? inferProvider(this.model);
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.headers = buildProviderHeaders(config);
  }

  async synthesize(
    signals: RawSignal[],
    brand: TrendBrand,
  ): Promise<TrendSignal[]> {
    if (signals.length === 0) return [];
    if (!this.apiKey) return fallbackDedup(signals);

    const prompt = buildPrompt(signals, brand);
    const response =
      this.provider === "gemini"
        ? await this.fetchImpl(buildGeminiUrl(this.endpoint, this.model), {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.1,
                responseMimeType: "application/json",
              },
            }),
          })
        : await this.fetchImpl(buildChatCompletionsUrl(this.endpoint), {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify({
              model: this.model,
              messages: [{ role: "user", content: prompt }],
              temperature: 0.1,
              response_format: { type: "json_object" },
            }),
          });

    if (!response.ok) {
      throw new Error(`Trend synthesis request failed: ${response.status}`);
    }

    if (this.provider === "gemini") {
      const data = (await response.json()) as GeminiResponse;
      const content =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text ?? "")
          .join("") ?? "";
      return parseTrendSignals(content, signals);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    return parseTrendSignals(
      data.choices?.[0]?.message?.content ?? "",
      signals,
    );
  }
}
