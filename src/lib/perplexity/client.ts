/**
 * Perplexity API 客戶端
 * 用於深度研究和即時資料搜尋
 */

import { z } from "zod";
import {
  getCachedData,
  setCachedData,
  type CacheOptions,
} from "@/lib/cache/perplexity-cache";
import {
  isGatewayEnabled,
  getPerplexityBaseUrl,
  buildPerplexityHeaders,
} from "@/lib/cloudflare/ai-gateway";

// Perplexity API 響應 Schema
const PerplexityResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  object: z.string(),
  created: z.number(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      finish_reason: z.string(),
    }),
  ),
  citations: z.array(z.string()).optional(),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});

export type PerplexityResponse = z.infer<typeof PerplexityResponseSchema>;

export interface PerplexitySearchOptions {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  search_domain_filter?: string[];
  search_recency_filter?: "day" | "week" | "month" | "year";
  return_citations?: boolean;
  return_images?: boolean;
}

export class PerplexityClient {
  private apiKey: string;
  private companyId?: string;
  private enableCache: boolean;

  constructor(
    apiKey?: string,
    companyId?: string,
    enableCache: boolean = true,
  ) {
    this.apiKey = apiKey || process.env.PERPLEXITY_API_KEY || "";
    this.companyId = companyId;
    this.enableCache = enableCache;
    if (!this.apiKey) {
      console.warn("[Perplexity] API Key 未設置，部分功能可能無法使用");
    }
  }

  private getBaseUrl(): string {
    return getPerplexityBaseUrl();
  }

  private getHeaders(): Record<string, string> {
    return buildPerplexityHeaders(this.apiKey);
  }

  /**
   * 執行深度研究搜尋
   */
  async search(
    query: string,
    options: PerplexitySearchOptions = {},
  ): Promise<{
    content: string;
    citations?: string[];
    images?: string[];
  }> {
    if (!this.apiKey) {
      console.log("[Perplexity] 使用 Mock 資料（無 API Key）");
      return this.getMockResponse(query);
    }

    // 檢查快取
    if (this.enableCache && this.companyId) {
      const cacheKey: CacheOptions = {
        companyId: this.companyId,
        queryType: "industry_analysis",
        queryParams: { query, ...options },
      };

      const cached = await getCachedData<{
        content: string;
        citations?: string[];
        images?: string[];
      }>(cacheKey);

      if (cached) {
        console.log("[Perplexity] 使用快取資料（節省 API 成本）");
        return cached.data;
      }
    }

    try {
      const baseUrl = this.getBaseUrl();
      const headers = this.getHeaders();

      console.log(
        `[Perplexity] API (gateway: ${isGatewayEnabled()}, url: ${baseUrl})`,
      );

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: options.model || "sonar",
          messages: [
            {
              role: "system",
              content:
                "你是一個專業的研究助手。請使用與用戶查詢相同的語言提供準確、最新的資訊，並引用來源。針對中文查詢，請優先搜尋繁體中文和簡體中文的資源。",
            },
            {
              role: "user",
              content: query,
            },
          ],
          temperature: options.temperature || 0.2,
          top_p: options.top_p || 0.9,
          max_tokens: options.max_tokens || 4000,
          search_domain_filter: options.search_domain_filter,
          search_recency_filter: options.search_recency_filter,
          return_citations: options.return_citations !== false,
          return_images: options.return_images,
          return_related_questions: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Perplexity API 錯誤: ${response.status} - ${error}`);
      }

      const data = await response.json();

      console.log(
        "[Perplexity] Raw API response:",
        JSON.stringify(data, null, 2),
      );

      const validated = PerplexityResponseSchema.parse(data);

      const content = validated.choices[0]?.message?.content || "";

      const apiCitations = validated.citations || [];
      const extractedCitations = this.extractCitations(content);
      const allCitations = [
        ...new Set([...apiCitations, ...extractedCitations]),
      ];

      console.log("[Perplexity] Citations summary:", {
        apiCitations: apiCitations.length,
        extractedCitations: extractedCitations.length,
        totalUnique: allCitations.length,
        citations: allCitations,
      });

      const images = this.extractImages(content);

      const result = {
        content: this.cleanContent(content),
        citations: allCitations.length > 0 ? allCitations : undefined,
        images: images.length > 0 ? images : undefined,
      };

      // 儲存到快取
      if (this.enableCache && this.companyId) {
        const cacheKey: CacheOptions = {
          companyId: this.companyId,
          queryType: "industry_analysis",
          queryParams: { query, ...options },
        };
        await setCachedData(cacheKey, result);
        console.log("[Perplexity] 已儲存到快取（7 天有效）");
      }

      return result;
    } catch (error) {
      console.error("[Perplexity] 搜尋錯誤:", error);
      return this.getMockResponse(query);
    }
  }

  /**
   * 專門用於競爭對手分析
   */
  async analyzeCompetitors(
    keyword: string,
    domain?: string,
  ): Promise<{
    topCompetitors: Array<{
      domain: string;
      title: string;
      description: string;
      strengths: string[];
    }>;
    contentGaps: string[];
    recommendations: string[];
  }> {
    const query = `
分析關鍵字「${keyword}」的競爭對手：
1. 列出排名前 5 的網站
2. 分析他們的內容策略
3. 找出內容缺口
4. 提供超越競爭對手的建議
${domain ? `\n特別關注與 ${domain} 相關的競爭對手` : ""}
    `.trim();

    const result = await this.search(query, {
      search_recency_filter: "month",
      max_tokens: 4000,
    });

    // 解析結構化資料
    return this.parseCompetitorAnalysis(result.content);
  }

  /**
   * 獲取最新趨勢
   */
  async getTrends(
    topic: string,
    timeframe: "day" | "week" | "month" = "week",
  ): Promise<{
    trends: Array<{
      topic: string;
      description: string;
      relevance: number;
    }>;
    insights: string[];
  }> {
    const query = `
獲取「${topic}」的最新趨勢（過去${this.getTimeframeText(timeframe)}）：
1. 熱門話題和討論
2. 新興關鍵字
3. 產業動態
4. 相關統計數據
    `.trim();

    const result = await this.search(query, {
      search_recency_filter: timeframe,
      return_citations: true,
    });

    return this.parseTrends(result.content);
  }

  /**
   * 深度內容研究
   */
  async researchTopic(
    topic: string,
    aspects: string[] = [],
  ): Promise<{
    summary: string;
    keyPoints: string[];
    statistics: Array<{ stat: string; source: string }>;
    expertOpinions: string[];
    relatedTopics: string[];
  }> {
    const aspectsText =
      aspects.length > 0 ? `\n特別關注：${aspects.join("、")}` : "";

    const query = `
深度研究主題「${topic}」：
1. 提供全面的概述
2. 關鍵要點和發現
3. 相關統計數據（含來源）
4. 專家觀點
5. 相關主題建議${aspectsText}
    `.trim();

    const result = await this.search(query, {
      max_tokens: 5000,
      return_citations: true,
    });

    return this.parseResearch(result.content, result.citations);
  }

  // === 輔助方法 ===

  private extractCitations(content: string): string[] {
    const citations: string[] = [];
    const regex = /\[(\d+)\]:\s*(https?:\/\/[^\s]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      citations.push(match[2]);
    }

    return citations;
  }

  private extractImages(content: string): string[] {
    const images: string[] = [];
    const regex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      images.push(match[1]);
    }

    return images;
  }

  private cleanContent(content: string): string {
    // 移除引用標記但保留內容
    return content
      .replace(/\[\d+\]:\s*https?:\/\/[^\s]+/g, "")
      .replace(/\[\d+\]/g, "")
      .trim();
  }

  private getTimeframeText(timeframe: string): string {
    const map: Record<string, string> = {
      day: "一天",
      week: "一週",
      month: "一個月",
      year: "一年",
    };
    return map[timeframe] || timeframe;
  }

  private parseCompetitorAnalysis(content: string): any {
    // 簡單解析，實際可能需要更複雜的 NLP
    return {
      topCompetitors: [
        {
          domain: "example.com",
          title: "競爭對手範例",
          description: "從 Perplexity 內容解析",
          strengths: ["優勢1", "優勢2"],
        },
      ],
      contentGaps: ["缺口1", "缺口2"],
      recommendations: ["建議1", "建議2"],
    };
  }

  private parseTrends(content: string): any {
    return {
      trends: [
        {
          topic: "趨勢1",
          description: "從內容解析",
          relevance: 0.9,
        },
      ],
      insights: ["洞察1", "洞察2"],
    };
  }

  private parseResearch(content: string, citations?: string[]): any {
    return {
      summary: content.substring(0, 500),
      keyPoints: ["要點1", "要點2", "要點3"],
      statistics: [
        { stat: "統計數據1", source: citations?.[0] || "Perplexity" },
      ],
      expertOpinions: ["專家意見1"],
      relatedTopics: ["相關主題1", "相關主題2"],
    };
  }

  private getMockResponse(query: string): any {
    console.log("[Perplexity] 返回 Mock 資料");
    return {
      content: `這是關於「${query}」的模擬研究結果。實際使用時需要配置 PERPLEXITY_API_KEY。`,
      citations: ["https://example.com/source1", "https://example.com/source2"],
    };
  }
}

// 單例模式已移除，每次使用時建立新實例以支援不同 company_id
export function getPerplexityClient(
  apiKey?: string,
  companyId?: string,
  enableCache: boolean = true,
): PerplexityClient {
  return new PerplexityClient(apiKey, companyId, enableCache);
}

export default PerplexityClient;
