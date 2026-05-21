import type { GSCClient, RawSignal, TrendBrand } from "../aggregator";

type FetchLike = typeof fetch;

type GSCPerformanceRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type GSCPerformanceResponse = {
  rows?: GSCPerformanceRow[];
};

export interface GSCClientConfig {
  apiKey: string;
  endpoint: string;
  siteUrl?: string;
  fetchImpl?: FetchLike;
  now?: () => Date;
}

function trimEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function lastSevenDays(now: Date): { startDate: string; endDate: string } {
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() - 1);

  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);

  return {
    startDate: dateOnly(start),
    endDate: dateOnly(end),
  };
}

function clampConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0.5;
  return Math.min(1, Math.max(0, confidence));
}

export class HttpGSCClient implements GSCClient {
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly siteUrl?: string;
  private readonly fetchImpl: FetchLike;
  private readonly now: () => Date;

  constructor(config: GSCClientConfig) {
    this.apiKey = config.apiKey;
    this.endpoint = trimEndpoint(config.endpoint);
    this.siteUrl = config.siteUrl;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => new Date());
  }

  async fetchTopQueries(brand: TrendBrand): Promise<RawSignal[]> {
    const siteUrl = brand.gscSiteUrl ?? this.siteUrl;
    if (!this.apiKey || !siteUrl) {
      return [];
    }

    const { startDate, endDate } = lastSevenDays(this.now());
    const response = await this.fetchImpl(
      `${this.endpoint}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["query"],
          type: "web",
          rowLimit: 20,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`GSC query trends request failed: ${response.status}`);
    }

    const data = (await response.json()) as GSCPerformanceResponse;
    const rows = data.rows ?? [];
    const maxImpressions = Math.max(
      1,
      ...rows.map((row) => row.impressions ?? 0),
    );

    return rows.flatMap((row): RawSignal[] => {
      const query = row.keys?.[0]?.trim();
      if (!query) return [];

      const impressions = row.impressions ?? 0;
      const ctr = row.ctr ?? 0;
      const confidence = clampConfidence(
        0.35 + (impressions / maxImpressions) * 0.45 + ctr * 0.2,
      );

      return [
        {
          topic: query,
          source: "gsc",
          confidence,
          metadata: {
            clicks: row.clicks ?? 0,
            impressions,
            ctr,
            position: row.position ?? null,
            startDate,
            endDate,
            siteUrl,
          },
        },
      ];
    });
  }
}
