/**
 * Brave Search API 客戶端
 * 免費方案：2000 次查詢/月
 * 用於 FREE plan 的替代搜尋方案
 */

import { z } from "zod";

// Brave Search API 響應 Schema
const BraveSearchResultSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
  age: z.string().optional(),
  page_age: z.string().optional(),
  page_fetched: z.string().optional(),
});

const BraveWebSearchSchema = z.object({
  type: z.literal("search"),
  results: z.array(BraveSearchResultSchema).optional(),
});

const BraveSearchResponseSchema = z.object({
  query: z.object({
    original: z.string(),
    show_strict_warning: z.boolean().optional(),
    altered: z.string().optional(),
    safesearch: z.boolean().optional(),
    is_navigational: z.boolean().optional(),
    is_geolocated: z.boolean().optional(),
    local_decision: z.string().optional(),
    local_locations_idx: z.number().optional(),
    is_trending: z.boolean().optional(),
    is_news_breaking: z.boolean().optional(),
    ask_for_location: z.boolean().optional(),
    language: z
      .object({
        main: z.string().optional(),
      })
      .optional(),
    spellcheck_off: z.boolean().optional(),
    country: z.string().optional(),
    bad_results: z.boolean().optional(),
    should_fallback: z.boolean().optional(),
    lat: z.string().optional(),
    long: z.string().optional(),
    postal_code: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    header_country: z.string().optional(),
    more_results_available: z.boolean().optional(),
    custom_location_label: z.string().optional(),
    reddit_cluster: z.string().optional(),
  }),
  mixed: z
    .object({
      type: z.literal("mixed"),
      main: z.array(z.any()).optional(),
      top: z.array(z.any()).optional(),
      side: z.array(z.any()).optional(),
    })
    .optional(),
  type: z.literal("search"),
  web: BraveWebSearchSchema.optional(),
});

export type BraveSearchResponse = z.infer<typeof BraveSearchResponseSchema>;
export type BraveSearchResult = z.infer<typeof BraveSearchResultSchema>;

export interface BraveSearchOptions {
  count?: number; // 結果數量 (1-20)
  offset?: number; // 分頁偏移
  safesearch?: "off" | "moderate" | "strict";
  freshness?: string; // 例如: "pd" (過去一天), "pw" (過去一週), "pm" (過去一月)
  text_decorations?: boolean;
  spellcheck?: boolean;
  result_filter?: "web" | "news" | "videos";
}

export class BraveSearchClient {
  private apiKey: string;
  private baseUrl = "https://api.search.brave.com/res/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[BraveSearch] API Key 未設置");
    }
  }

  /**
   * 執行網頁搜尋
   */
  async search(
    query: string,
    options: BraveSearchOptions = {},
  ): Promise<{
    content: string;
    citations?: string[];
  }> {
    if (!this.apiKey) {
      console.log("[BraveSearch] 使用 Mock 資料（無 API Key）");
      return this.getMockResponse(query);
    }

    try {
      const params = new URLSearchParams({
        q: query,
        count: (options.count || 10).toString(),
        offset: (options.offset || 0).toString(),
        safesearch: options.safesearch || "moderate",
        text_decorations: (options.text_decorations !== false).toString(),
        spellcheck: (options.spellcheck !== false).toString(),
      });

      if (options.freshness) {
        params.append("freshness", options.freshness);
      }

      if (options.result_filter) {
        params.append("result_filter", options.result_filter);
      }

      const response = await fetch(`${this.baseUrl}/web/search?${params}`, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Brave Search API 錯誤: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const validated = BraveSearchResponseSchema.parse(data);

      // 提取搜尋結果
      const results = validated.web?.results || [];

      // 組合內容摘要
      const content = this.formatResults(results);

      // 提取 citations
      const citations = results
        .filter((r) => r.url)
        .map((r) => r.url!)
        .slice(0, 5); // 只取前 5 個來源

      return {
        content,
        citations: citations.length > 0 ? citations : undefined,
      };
    } catch (error) {
      console.error("[BraveSearch] 搜尋錯誤:", error);
      return this.getMockResponse(query);
    }
  }

  /**
   * 產業分析（使用 Brave Search）
   */
  async analyzeIndustry(
    industry: string,
    region: string,
    language: string,
  ): Promise<{
    content: string;
    citations?: string[];
  }> {
    const query = `${industry} industry trends ${region} ${language}`;

    return await this.search(query, {
      count: 15,
      freshness: "pm", // 過去一月
    });
  }

  /**
   * 競爭對手基礎分析（不涉及深度內容分析）
   */
  async basicCompetitorInfo(competitorUrls: string[]): Promise<{
    competitors: Array<{
      url: string;
      title?: string;
      description?: string;
    }>;
  }> {
    if (!this.apiKey) {
      return { competitors: [] };
    }

    const competitors = [];

    for (const url of competitorUrls.slice(0, 3)) {
      try {
        // 搜尋該網站的基本資訊
        const result = await this.search(`site:${url}`, { count: 1 });

        competitors.push({
          url,
          title: "競爭對手網站",
          description: result.content.substring(0, 200),
        });
      } catch (error) {
        console.error(`[BraveSearch] 無法取得 ${url} 資訊:`, error);
      }
    }

    return { competitors };
  }

  // === 輔助方法 ===

  private formatResults(results: BraveSearchResult[]): string {
    if (results.length === 0) {
      return "未找到相關結果";
    }

    const formatted = results
      .filter((r) => r.title && r.description)
      .map((r, idx) => {
        return `${idx + 1}. ${r.title}\n${r.description}`;
      })
      .join("\n\n");

    return formatted || "未找到有效結果";
  }

  private getMockResponse(query: string): {
    content: string;
    citations?: string[];
  } {
    console.log("[BraveSearch] 返回 Mock 資料");
    return {
      content: `這是關於「${query}」的模擬搜尋結果（Brave Search Mock）。實際使用時需要配置 BRAVE_SEARCH_API_KEY。`,
      citations: [
        "https://example.com/brave-result-1",
        "https://example.com/brave-result-2",
      ],
    };
  }
}

export function getBraveSearchClient(apiKey?: string): BraveSearchClient {
  return new BraveSearchClient(apiKey);
}

export default BraveSearchClient;
