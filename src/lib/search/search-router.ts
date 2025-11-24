/**
 * 搜尋 API 路由器
 * 根據訂閱方案和配額自動選擇最佳 API
 */

import { getPerplexityClient } from "@/lib/perplexity/client";
import { getBraveSearchClient } from "@/lib/brave-search/client";
import {
  getCompanyQuotaStatus,
  checkAndIncrementQuota,
} from "@/lib/quota/quota-service";

export type SearchProvider = "perplexity" | "brave" | "mock";

export interface SearchResult {
  content: string;
  citations?: string[];
  provider: SearchProvider;
}

export interface SearchRouterOptions {
  companyId: string;
  preferredProvider?: SearchProvider;
  enableCache?: boolean;
}

/**
 * 智能搜尋路由器
 * - FREE plan: 使用 Brave Search（免費 2000 次/月）
 * - STARTER/PRO/BIZ: 使用 Perplexity（受配額限制）
 * - AGENCY: 使用 Perplexity（無限制）
 */
export class SearchRouter {
  private companyId: string;
  private enableCache: boolean;

  constructor(options: SearchRouterOptions) {
    this.companyId = options.companyId;
    this.enableCache = options.enableCache !== false;
  }

  /**
   * 執行智能搜尋（自動選擇 API）
   */
  async search(query: string): Promise<SearchResult> {
    const provider = await this.selectProvider();

    console.log(`[SearchRouter] 選擇搜尋服務: ${provider}`);

    switch (provider) {
      case "perplexity":
        return await this.searchWithPerplexity(query);

      case "brave":
        return await this.searchWithBrave(query);

      default:
        return {
          content: `關於「${query}」的模擬結果（無可用 API）`,
          provider: "mock",
        };
    }
  }

  /**
   * 產業分析
   */
  async analyzeIndustry(
    industry: string,
    region: string,
    language: string,
  ): Promise<SearchResult> {
    const provider = await this.selectProvider();

    console.log(`[SearchRouter] 產業分析使用: ${provider}`);

    switch (provider) {
      case "perplexity": {
        const client = getPerplexityClient(
          undefined,
          this.companyId,
          this.enableCache,
        );

        const query = `分析「${industry}」產業在「${region}」的市場趨勢和機會（使用 ${language} 回答）`;

        const result = await client.search(query, {
          search_recency_filter: "month",
          max_tokens: 3000,
        });

        return {
          ...result,
          provider: "perplexity",
        };
      }

      case "brave": {
        const client = getBraveSearchClient();
        const result = await client.analyzeIndustry(industry, region, language);

        return {
          ...result,
          provider: "brave",
        };
      }

      default:
        return {
          content: `關於「${industry}」在「${region}」的模擬分析`,
          provider: "mock",
        };
    }
  }

  /**
   * 競爭對手分析（僅付費方案）
   */
  async analyzeCompetitors(competitors: string[]): Promise<{
    allowed: boolean;
    message?: string;
    results?: SearchResult[];
  }> {
    // 檢查配額
    const quotaStatus = await getCompanyQuotaStatus(this.companyId);

    if (!quotaStatus || quotaStatus.quota === 0) {
      return {
        allowed: false,
        message: "您的方案不支援競爭對手分析，請升級至 STARTER 或更高方案",
      };
    }

    if (quotaStatus.quota > 0 && quotaStatus.remaining <= 0) {
      return {
        allowed: false,
        message: `已達到每月配額上限（${quotaStatus.quota} 次），請升級方案或等待下月重置`,
      };
    }

    // 檢查並扣除配額
    const quotaCheck = await checkAndIncrementQuota(
      this.companyId,
      competitors.length,
    );

    if (!quotaCheck.allowed) {
      return {
        allowed: false,
        message: quotaCheck.message || "配額不足",
      };
    }

    // 使用 Perplexity 進行深度分析
    const client = getPerplexityClient(
      undefined,
      this.companyId,
      this.enableCache,
    );

    const results: SearchResult[] = [];

    for (const competitor of competitors) {
      try {
        const result = await client.search(
          `分析網站 ${competitor} 的內容策略、關鍵字和優勢`,
          {
            search_domain_filter: [competitor],
            max_tokens: 2000,
          },
        );

        results.push({
          ...result,
          provider: "perplexity",
        });
      } catch (error) {
        console.error(
          `[SearchRouter] 競爭對手分析失敗 (${competitor}):`,
          error,
        );
      }
    }

    return {
      allowed: true,
      results,
    };
  }

  // === 私有方法 ===

  /**
   * 選擇最佳搜尋服務
   */
  private async selectProvider(): Promise<SearchProvider> {
    const quotaStatus = await getCompanyQuotaStatus(this.companyId);

    if (!quotaStatus) {
      console.warn("[SearchRouter] 無法取得配額狀態，使用 mock");
      return "mock";
    }

    // FREE plan: 使用 Brave Search
    if (quotaStatus.plan === "free") {
      return "brave";
    }

    // 付費方案但配額已用完: 降級到 Brave Search
    if (quotaStatus.quota > 0 && quotaStatus.remaining <= 0) {
      console.log("[SearchRouter] Perplexity 配額已用完，降級到 Brave Search");
      return "brave";
    }

    // STARTER/PRO/BIZ/AGENCY: 使用 Perplexity
    return "perplexity";
  }

  private async searchWithPerplexity(query: string): Promise<SearchResult> {
    // 檢查並扣除配額
    const quotaCheck = await checkAndIncrementQuota(this.companyId, 1);

    if (!quotaCheck.allowed) {
      console.log("[SearchRouter] Perplexity 配額不足，降級到 Brave Search");
      return await this.searchWithBrave(query);
    }

    const client = getPerplexityClient(
      undefined,
      this.companyId,
      this.enableCache,
    );

    const result = await client.search(query);

    return {
      ...result,
      provider: "perplexity",
    };
  }

  private async searchWithBrave(query: string): Promise<SearchResult> {
    const client = getBraveSearchClient();
    const result = await client.search(query);

    return {
      ...result,
      provider: "brave",
    };
  }
}

/**
 * 建立搜尋路由器實例
 */
export function createSearchRouter(options: SearchRouterOptions): SearchRouter {
  return new SearchRouter(options);
}
