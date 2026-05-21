import type { PerplexityClient, RawSignal, TrendBrand } from "../aggregator";

type FetchLike = typeof fetch;

type PerplexityChoice = {
  message?: {
    content?: string;
  };
};

type PerplexityResponse = {
  choices?: PerplexityChoice[];
  citations?: string[];
};

export interface PerplexityClientConfig {
  apiKey: string;
  endpoint: string;
  cfAigToken?: string;
  model?: string;
  fetchImpl?: FetchLike;
}

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function buildHeaders(config: PerplexityClientConfig): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.cfAigToken) {
    headers["cf-aig-authorization"] = `Bearer ${config.cfAigToken}`;
  }

  return headers;
}

function clampConfidence(confidence: unknown): number {
  const value = typeof confidence === "number" ? confidence : 0.65;
  if (!Number.isFinite(value)) return 0.65;
  return Math.min(1, Math.max(0, value));
}

function parseJsonArray(content: string): unknown[] {
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

function parseFallbackTopics(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[-*\d.)]+\s*/, "")
        .replace(/\*\*/g, "")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 20);
}

export class HttpPerplexityClient implements PerplexityClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetchImpl: FetchLike;
  private readonly headers: Record<string, string>;

  constructor(config: PerplexityClientConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = trimEndpoint(config.endpoint);
    this.model = config.model ?? "sonar";
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.headers = buildHeaders(config);
  }

  async fetchWeeklyTrends(brand: TrendBrand): Promise<RawSignal[]> {
    if (!this.apiKey || brand.keywords.length === 0) {
      return [];
    }

    const industry = brand.industry ?? brand.keywords.join(", ");
    const response = await this.fetchImpl(`${this.endpoint}/chat/completions`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content:
              "Return concise weekly topic recommendations as JSON only.",
          },
          {
            role: "user",
            content:
              `What are trending topics in ${industry} this week? ` +
              "Return an array of objects with topic, confidence, and reason.",
          },
        ],
        temperature: 0.2,
        max_tokens: 1200,
        search_recency_filter: "week",
        return_citations: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity trends request failed: ${response.status}`);
    }

    const data = (await response.json()) as PerplexityResponse;
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsedTopics = parseJsonArray(content);
    const topics =
      parsedTopics.length > 0 ? parsedTopics : parseFallbackTopics(content);

    return topics.flatMap((topic): RawSignal[] => {
      if (typeof topic === "string") {
        return [
          {
            topic,
            source: "perplexity",
            confidence: 0.65,
            metadata: { citations: data.citations ?? [] },
          },
        ];
      }

      if (!topic || typeof topic !== "object") return [];
      const record = topic as Record<string, unknown>;
      if (typeof record.topic !== "string") return [];

      return [
        {
          topic: record.topic,
          source: "perplexity",
          confidence: clampConfidence(record.confidence),
          metadata: {
            reason: record.reason,
            citations: data.citations ?? [],
          },
        },
      ];
    });
  }
}
