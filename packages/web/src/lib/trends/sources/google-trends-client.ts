import * as cheerio from "cheerio";
import type {
  GoogleTrendsRssClient,
  RawSignal,
  TrendBrand,
} from "../aggregator";

type FetchLike = typeof fetch;

export interface GoogleTrendsRssClientConfig {
  apiKey?: string;
  endpoint: string;
  geo?: string;
  fetchImpl?: FetchLike;
}

function parseTraffic(traffic: string): number {
  const normalized = traffic.replace(/,/g, "").trim().toUpperCase();
  const match = normalized.match(/^([\d.]+)\s*([KMB])?/);
  if (!match) return 0;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return 0;

  const multiplier =
    match[2] === "B"
      ? 1_000_000_000
      : match[2] === "M"
        ? 1_000_000
        : match[2] === "K"
          ? 1_000
          : 1;

  return value * multiplier;
}

function trafficConfidence(traffic: number): number {
  if (traffic <= 0) return 0.5;
  return Math.min(1, Math.max(0, 0.45 + Math.log10(traffic + 1) / 8));
}

function withGeo(endpoint: string, geo?: string): string {
  const url = new URL(endpoint);
  if (geo) {
    url.searchParams.set("geo", geo);
  }
  return url.toString();
}

export class HttpGoogleTrendsRssClient implements GoogleTrendsRssClient {
  private readonly endpoint: string;
  private readonly geo?: string;
  private readonly fetchImpl: FetchLike;

  constructor(config: GoogleTrendsRssClientConfig) {
    this.endpoint = config.endpoint;
    this.geo = config.geo;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchWeeklyTrends(brand: TrendBrand): Promise<RawSignal[]> {
    const response = await this.fetchImpl(
      withGeo(this.endpoint, brand.geography ?? this.geo),
    );

    if (!response.ok) {
      throw new Error(`Google Trends RSS request failed: ${response.status}`);
    }

    const rss = await response.text();
    const $ = cheerio.load(rss, { xmlMode: true });

    return $("item")
      .slice(0, 20)
      .toArray()
      .flatMap((item): RawSignal[] => {
        const node = $(item);
        const title = node.find("title").first().text().trim();
        if (!title) return [];

        const trafficText =
          node.find("ht\\:approx_traffic").first().text().trim() ||
          node.find("approx_traffic").first().text().trim();
        const traffic = parseTraffic(trafficText);

        return [
          {
            topic: title,
            source: "google_trends",
            confidence: trafficConfidence(traffic),
            metadata: {
              traffic,
              trafficText,
              publishedAt: node.find("pubDate").first().text().trim() || null,
              newsUrl:
                node.find("ht\\:news_item_url").first().text().trim() || null,
            },
          },
        ];
      });
  }
}
