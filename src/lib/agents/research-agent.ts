import { BaseAgent } from "./base-agent";
import type {
  ResearchInput,
  ResearchOutput,
  SERPResult,
  ExternalReference,
} from "@/types/agents";
import { getPerplexityClient } from "@/lib/perplexity/client";

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  get agentName(): string {
    return "ResearchAgent";
  }

  protected async process(input: ResearchInput): Promise<ResearchOutput> {
    const analysis = await this.analyzeTitle(input);

    const externalReferences = await this.fetchExternalReferences(input.title);

    return {
      title: input.title,
      region: input.region,
      searchIntent: analysis.searchIntent,
      intentConfidence: analysis.intentConfidence,
      topRankingFeatures: analysis.topRankingFeatures,
      contentGaps: analysis.contentGaps,
      competitorAnalysis: analysis.competitorAnalysis,
      recommendedStrategy: analysis.recommendedStrategy,
      relatedKeywords: analysis.relatedKeywords,
      externalReferences,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async analyzeTitle(
    input: ResearchInput,
  ): Promise<
    Omit<
      ResearchOutput,
      "title" | "region" | "externalReferences" | "executionInfo"
    >
  > {
    const prompt = `你是一位 SEO 專家，請針對文章標題「${input.title}」進行深入分析。

文章標題: ${input.title}
地區: ${input.region || "Taiwan"}

請分析以下項目：

1. **搜尋意圖** (searchIntent):
   - 類型：informational（資訊型）、commercial（商業型）、transactional（交易型）、navigational（導航型）
   - 信心度 (intentConfidence): 0-1 之間

2. **高排名內容特徵** (topRankingFeatures):
   - 內容長度：最短、最長、平均字數
   - 標題模式：常見的標題結構
   - 內容結構：段落組織方式
   - 常見主題：經常討論的子主題
   - 常見格式：列表、教學、比較等

3. **內容缺口** (contentGaps):
   - 列出競爭對手沒有深入探討的角度

4. **競爭對手分析** (competitorAnalysis):
   - 列出 3-5 個相關權威網站
   - 每個網站的標題、網域、字數估計
   - 優勢和弱點
   - 獨特切入角度

5. **推薦策略** (recommendedStrategy):
   - 基於以上分析，提出內容創作建議

6. **相關關鍵字** (relatedKeywords):
   - 列出 5-10 個相關搜尋詞

請用結構化的方式回答，每個項目分開說明。`;

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.3,
      maxTokens: input.maxTokens || 64000,
    });

    try {
      if (!response.content || response.content.trim() === "") {
        console.warn("[ResearchAgent] Empty response, using fallback analysis");
        return this.getFallbackAnalysis(input.title);
      }

      const content = response.content.trim();

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.searchIntent && parsed.topRankingFeatures) {
            return parsed;
          }
        } catch {
          console.log(
            "[ResearchAgent] JSON parsing failed, parsing structured text",
          );
        }
      }

      return this.parseStructuredText(content, input.title);
    } catch (parseError) {
      this.log("error", "Analysis parsing failed", {
        error: parseError,
        content: response.content.substring(0, 500),
      });
      console.warn("[ResearchAgent] Parse error, using fallback analysis");
      return this.getFallbackAnalysis(input.title);
    }
  }

  private parseStructuredText(
    content: string,
    title: string,
  ): Omit<
    ResearchOutput,
    "title" | "region" | "externalReferences" | "executionInfo"
  > {
    const searchIntent = this.extractSearchIntent(content);
    const intentConfidence = 0.8;

    const contentLengthMatch = content.match(/(\d+)\s*-\s*(\d+)\s*字/);
    const minLength = contentLengthMatch
      ? parseInt(contentLengthMatch[1])
      : 1000;
    const maxLength = contentLengthMatch
      ? parseInt(contentLengthMatch[2])
      : 3000;
    const avgLength = Math.floor((minLength + maxLength) / 2);

    const titlePatterns = this.extractListItems(content, /標題模式|標題結構/);
    const structurePatterns = this.extractListItems(
      content,
      /內容結構|段落組織/,
    );
    const commonTopics = this.extractListItems(content, /常見主題|子主題/);
    const commonFormats = this.extractListItems(content, /常見格式|格式類型/);
    const contentGaps = this.extractListItems(content, /內容缺口|缺乏|沒有/);
    const relatedKeywords = this.extractListItems(
      content,
      /相關關鍵字|相關搜尋|LSI/,
    );

    return {
      searchIntent,
      intentConfidence,
      topRankingFeatures: {
        contentLength: { min: minLength, max: maxLength, avg: avgLength },
        titlePatterns:
          titlePatterns.length > 0
            ? titlePatterns
            : [title, `${title}完整指南`],
        structurePatterns:
          structurePatterns.length > 0
            ? structurePatterns
            : ["介紹", "步驟說明", "總結"],
        commonTopics:
          commonTopics.length > 0 ? commonTopics : ["基礎概念", "實用技巧"],
        commonFormats:
          commonFormats.length > 0 ? commonFormats : ["教學文章", "指南"],
      },
      contentGaps:
        contentGaps.length > 0 ? contentGaps : ["缺少實際案例", "缺少詳細步驟"],
      competitorAnalysis: [],
      recommendedStrategy: this.extractStrategy(content, title),
      relatedKeywords:
        relatedKeywords.length > 0
          ? relatedKeywords
          : [`${title}教學`, `${title}技巧`],
    };
  }

  private extractSearchIntent(
    content: string,
  ): "informational" | "commercial" | "transactional" | "navigational" {
    const lowerContent = content.toLowerCase();
    if (
      lowerContent.includes("transactional") ||
      lowerContent.includes("交易型")
    )
      return "transactional";
    if (lowerContent.includes("commercial") || lowerContent.includes("商業型"))
      return "commercial";
    if (
      lowerContent.includes("navigational") ||
      lowerContent.includes("導航型")
    )
      return "navigational";
    return "informational";
  }

  private extractListItems(content: string, pattern: RegExp): string[] {
    const section = content.split(/\d+\./g).find((s) => pattern.test(s));
    if (!section) return [];

    const items: string[] = [];
    const lines = section.split("\n");
    for (const line of lines) {
      const match = line.match(/[-•]\s*(.+)/);
      if (match && match[1].trim()) {
        items.push(match[1].trim().replace(/[:：].*$/, ""));
      }
    }
    return items.slice(0, 5);
  }

  private extractStrategy(content: string, title: string): string {
    const strategyMatch = content.match(/推薦策略|建議策略[\s\S]{0,300}/);
    if (strategyMatch) {
      return strategyMatch[0]
        .replace(/推薦策略|建議策略[：:]?\s*/, "")
        .trim()
        .substring(0, 200);
    }
    return `創建全面且實用的「${title}」內容，包含基礎知識和實用案例`;
  }

  private getFallbackAnalysis(
    title: string,
  ): Omit<
    ResearchOutput,
    "title" | "region" | "externalReferences" | "executionInfo"
  > {
    return {
      searchIntent: "informational",
      intentConfidence: 0.7,
      topRankingFeatures: {
        contentLength: { min: 1000, max: 3000, avg: 1500 },
        titlePatterns: [title, `${title}完整指南`, `${title}教學`],
        structurePatterns: ["介紹", "步驟說明", "常見問題", "總結"],
        commonTopics: ["基礎概念", "實用技巧", "進階應用"],
        commonFormats: ["教學文章", "指南", "列表文章"],
      },
      contentGaps: ["缺少實際案例", "缺少詳細步驟", "缺少常見問題解答"],
      competitorAnalysis: [
        {
          url: `https://example.com/articles`,
          title: `${title}相關內容`,
          position: 1,
          domain: "example.com",
          estimatedWordCount: 1500,
          strengths: ["內容詳細", "結構清晰"],
          weaknesses: ["缺少視覺元素", "更新不及時"],
          uniqueAngles: ["實用技巧", "案例分析"],
        },
      ],
      recommendedStrategy: `創建全面且實用的「${title}」指南，包含基礎概念、實用技巧和案例分析`,
      relatedKeywords: [`${title}教學`, `${title}技巧`, `${title}入門`],
    };
  }

  private async fetchExternalReferences(
    title: string,
  ): Promise<ExternalReference[]> {
    try {
      const perplexity = getPerplexityClient();

      const query = `找出關於「${title}」最權威和最新的 5 個外部來源，要求必須包含實際可訪問的 URL。

請按以下優先順序尋找：
1. Wikipedia 或百科全書
2. 官方文檔或官網
3. 學術研究或報告
4. 知名新聞網站或媒體
5. 權威部落格或產業網站

對於每個來源，請明確列出完整的 URL 連結。`;

      console.log("[ResearchAgent] 開始 Perplexity 搜尋:", title);

      const result = await perplexity.search(query, {
        return_citations: true,
        max_tokens: 3000,
      });

      console.log("[ResearchAgent] Perplexity 回應:", {
        contentLength: result.content?.length || 0,
        citationsCount: result.citations?.length || 0,
        citations: result.citations,
      });

      const references: ExternalReference[] = [];

      if (result.citations && result.citations.length > 0) {
        console.log(
          "[ResearchAgent] 處理 Perplexity citations:",
          result.citations,
        );

        for (let i = 0; i < Math.min(result.citations.length, 5); i++) {
          const url = result.citations[i];
          const type = this.categorizeUrl(url);

          references.push({
            url,
            title: this.extractTitleFromUrl(url),
            type,
            description: `關於「${title}」的權威來源`,
          });
        }
      }

      if (references.length === 0) {
        console.warn(
          "[ResearchAgent] 無法從 Perplexity 獲取引用，使用預設來源",
        );
        return this.getDefaultExternalReferences(title);
      }

      console.log("[ResearchAgent] 成功獲取", references.length, "個外部引用");
      return references;
    } catch (error) {
      console.error("[ResearchAgent] 獲取外部引用錯誤:", error);
      return this.getDefaultExternalReferences(title);
    }
  }

  private categorizeUrl(url: string): ExternalReference["type"] {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("wikipedia.org")) return "wikipedia";
    if (
      lowerUrl.includes("github.com") ||
      lowerUrl.includes("docs.") ||
      lowerUrl.includes("/docs/")
    )
      return "official_docs";
    if (
      lowerUrl.includes("arxiv.org") ||
      lowerUrl.includes("scholar.google") ||
      lowerUrl.includes(".edu")
    )
      return "research";
    if (
      lowerUrl.includes("techcrunch.com") ||
      lowerUrl.includes("wired.com") ||
      lowerUrl.includes("news")
    )
      return "news";

    return "blog";
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        return lastPart
          .replace(/-/g, " ")
          .replace(/_/g, " ")
          .replace(/\.[^.]+$/, "")
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
      }

      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  private getDefaultExternalReferences(title: string): ExternalReference[] {
    const encodedTitle = encodeURIComponent(title);
    const wikiTitle = encodeURIComponent(title.replace(/ /g, "_"));

    return [
      {
        url: `https://en.wikipedia.org/wiki/${wikiTitle}`,
        title: `${title} - Wikipedia`,
        type: "wikipedia",
        description: `關於「${title}」的百科全書資訊`,
      },
      {
        url: `https://scholar.google.com/scholar?q=${encodedTitle}`,
        title: `${title} - Google Scholar`,
        type: "research",
        description: `${title}學術研究文獻`,
      },
      {
        url: `https://www.google.com/search?q=${encodedTitle}`,
        title: `${title} - Google 搜尋`,
        type: "blog",
        description: `${title}相關搜尋結果`,
      },
    ];
  }
}
