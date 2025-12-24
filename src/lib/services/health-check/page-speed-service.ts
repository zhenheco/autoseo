/**
 * PageSpeed Insights API 服務
 * 負責調用 Google PageSpeed Insights API 獲取網站性能數據
 */

import {
  fetchJsonWithTimeout,
  FetchWithTimeoutOptions,
} from "@/lib/utils/fetch-with-timeout";
import type {
  CoreWebVitals,
  LighthouseScores,
  DeviceType,
} from "@/types/health-check";

// PageSpeed API 回應結構（簡化）
interface PageSpeedResponse {
  id: string;
  loadingExperience?: {
    metrics?: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
      INTERACTION_TO_NEXT_PAINT?: { percentile: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
      FIRST_CONTENTFUL_PAINT_MS?: { percentile: number };
      EXPERIMENTAL_TIME_TO_FIRST_BYTE?: { percentile: number };
    };
  };
  lighthouseResult?: {
    categories?: {
      performance?: { score: number | null };
      accessibility?: { score: number | null };
      seo?: { score: number | null };
      "best-practices"?: { score: number | null };
    };
    audits?: {
      "largest-contentful-paint"?: { numericValue?: number };
      "interaction-to-next-paint"?: { numericValue?: number };
      "cumulative-layout-shift"?: { numericValue?: number };
      "first-contentful-paint"?: { numericValue?: number };
      "server-response-time"?: { numericValue?: number };
    };
  };
}

export interface PageSpeedResult {
  coreWebVitals: CoreWebVitals;
  lighthouseScores: LighthouseScores;
  rawResponse?: PageSpeedResponse;
}

export class PageSpeedService {
  private apiKey: string;
  private baseUrl =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
  private timeout: number;

  constructor(options?: { apiKey?: string; timeout?: number }) {
    this.apiKey = options?.apiKey || process.env.GOOGLE_PAGESPEED_API_KEY || "";
    this.timeout = options?.timeout || 60000; // 預設 60 秒（PageSpeed API 可能較慢）

    if (!this.apiKey) {
      console.warn(
        "[PageSpeedService] No API key provided, will use limited API",
      );
    }
  }

  /**
   * 執行 PageSpeed 分析
   * @param url 要分析的網站 URL
   * @param strategy 設備類型 (mobile | desktop)
   * @returns PageSpeed 分析結果
   */
  async analyze(
    url: string,
    strategy: DeviceType = "mobile",
  ): Promise<PageSpeedResult> {
    // 建構 API URL（使用多個 category 參數）
    const apiUrl = `${this.baseUrl}?url=${encodeURIComponent(url)}&strategy=${strategy}&category=performance&category=accessibility&category=seo&category=best-practices${this.apiKey ? `&key=${this.apiKey}` : ""}`;

    console.log(`[PageSpeedService] Analyzing ${url} (${strategy})...`);

    const fetchOptions: FetchWithTimeoutOptions = {
      timeout: this.timeout,
      headers: {
        Accept: "application/json",
      },
    };

    try {
      const response = await fetchJsonWithTimeout<PageSpeedResponse>(
        apiUrl,
        fetchOptions,
      );

      return this.parseResponse(response);
    } catch (error) {
      console.error("[PageSpeedService] Error:", error);
      throw new Error(
        `PageSpeed analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * 解析 PageSpeed API 回應
   */
  private parseResponse(response: PageSpeedResponse): PageSpeedResult {
    const loadingExperience = response.loadingExperience?.metrics;
    const lighthouse = response.lighthouseResult;
    const audits = lighthouse?.audits;
    const categories = lighthouse?.categories;

    // 優先使用 Loading Experience 數據（真實用戶數據），否則使用 Lighthouse 數據
    const coreWebVitals: CoreWebVitals = {
      lcp_ms:
        loadingExperience?.LARGEST_CONTENTFUL_PAINT_MS?.percentile ??
        audits?.["largest-contentful-paint"]?.numericValue ??
        null,
      inp_ms:
        loadingExperience?.INTERACTION_TO_NEXT_PAINT?.percentile ??
        audits?.["interaction-to-next-paint"]?.numericValue ??
        null,
      cls:
        loadingExperience?.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null
          ? loadingExperience.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
          : (audits?.["cumulative-layout-shift"]?.numericValue ?? null),
      fcp_ms:
        loadingExperience?.FIRST_CONTENTFUL_PAINT_MS?.percentile ??
        audits?.["first-contentful-paint"]?.numericValue ??
        null,
      ttfb_ms:
        loadingExperience?.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ??
        audits?.["server-response-time"]?.numericValue ??
        null,
    };

    // Lighthouse 分數 (0-1 轉換為 0-100)
    const lighthouseScores: LighthouseScores = {
      performance_score:
        categories?.performance?.score != null
          ? Math.round(categories.performance.score * 100)
          : null,
      accessibility_score:
        categories?.accessibility?.score != null
          ? Math.round(categories.accessibility.score * 100)
          : null,
      seo_score:
        categories?.seo?.score != null
          ? Math.round(categories.seo.score * 100)
          : null,
      best_practices_score:
        categories?.["best-practices"]?.score != null
          ? Math.round(categories["best-practices"].score * 100)
          : null,
    };

    console.log("[PageSpeedService] Parsed results:", {
      coreWebVitals,
      lighthouseScores,
    });

    return {
      coreWebVitals,
      lighthouseScores,
      rawResponse: response,
    };
  }
}
