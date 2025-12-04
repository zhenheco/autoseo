import { BaseAgent } from "./base-agent";
import type {
  ResearchInput,
  ResearchOutput,
  ExternalReference,
  DeepResearchResult,
} from "@/types/agents";
import { getPerplexityClient } from "@/lib/perplexity/client";

interface UnifiedResearchResult {
  deepResearch: DeepResearchResult;
  externalReferences: ExternalReference[];
  referenceMapping: ResearchOutput["referenceMapping"];
}

export class ResearchAgent extends BaseAgent<ResearchInput, ResearchOutput> {
  get agentName(): string {
    return "ResearchAgent";
  }

  protected async process(input: ResearchInput): Promise<ResearchOutput> {
    console.log("[ResearchAgent] 開始順序執行：先 Perplexity 研究，再 AI 分析");

    const unifiedResearch = await this.executeUnifiedResearch(
      input.title,
      input.region,
    );

    const analysis = await this.analyzeTitle(input, unifiedResearch);

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
      externalReferences: unifiedResearch.externalReferences,
      referenceMapping: unifiedResearch.referenceMapping,
      deepResearch: unifiedResearch.deepResearch,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async executeUnifiedResearch(
    keyword: string,
    region?: string,
  ): Promise<UnifiedResearchResult> {
    const startTime = Date.now();
    try {
      const perplexity = getPerplexityClient();
      const regionStr = region || "Taiwan";
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      console.log("[ResearchAgent] 執行統一研究查詢:", keyword, regionStr);

      const query = `請針對「${keyword}」${regionStr !== "Taiwan" ? `（${regionStr}地區）` : ""} 進行綜合研究，提供以下資訊：

1. **最新趨勢**（${currentYear}-${nextYear}）：
   - 行業動態、專家見解、發展方向
   - 最新技術或方法

2. **常見問題與解決方案**：
   - 用戶常見疑問、FAQ
   - 實際使用體驗和建議

3. **權威數據與統計**：
   - 相關數據、市場資訊、實用統計
   - 成功案例或效果數據

4. **實用參考來源**：
   - 請提供 5-8 個最相關、最實用的來源網址
   - 可以是：服務商網站、產業部落格、新聞報導、教學文章、官方文檔
   - 不需要限制為學術或官方來源，實用性優先

請在回答中自然引用來源，確保資訊的可追溯性。`;

      const result = await perplexity.search(query, {
        return_citations: true,
        max_tokens: 4500,
      });

      const executionTime = Date.now() - startTime;

      console.log("[ResearchAgent] 統一研究查詢完成:", {
        contentLength: result.content?.length || 0,
        citationsCount: result.citations?.length || 0,
        executionTime,
      });

      const deepResearch = this.parseUnifiedContent(
        result.content || "",
        result.citations || [],
        executionTime,
      );

      const externalReferences = this.extractReferencesFromCitations(
        keyword,
        result.citations || [],
        result.content || "",
      );

      const referenceMapping = this.buildReferenceMapping(
        externalReferences,
        result.content || "",
        keyword,
      );

      return { deepResearch, externalReferences, referenceMapping };
    } catch (error) {
      console.warn("[ResearchAgent] 統一研究查詢失敗:", error);
      return {
        deepResearch: {},
        externalReferences: this.getDefaultExternalReferences(keyword),
        referenceMapping: [],
      };
    }
  }

  private buildReferenceMapping(
    references: ExternalReference[],
    content: string,
    keyword: string,
  ): ResearchOutput["referenceMapping"] {
    const sectionPatterns = [
      { pattern: /趨勢|動態|發展|方向/i, section: "趨勢與發展" },
      { pattern: /問題|疑問|FAQ|解決/i, section: "常見問題" },
      { pattern: /數據|統計|市場|案例/i, section: "數據與案例" },
      { pattern: /技巧|方法|步驟|教學/i, section: "實用技巧" },
      { pattern: /比較|優缺|選擇/i, section: "產品比較" },
      { pattern: /介紹|概述|定義|什麼是/i, section: "基礎介紹" },
    ];

    return references.map((ref, index) => {
      const urlContext = this.extractUrlContext(content, ref.url);

      const suggestedSections: string[] = [];
      for (const { pattern, section } of sectionPatterns) {
        if (pattern.test(urlContext) || pattern.test(ref.title)) {
          suggestedSections.push(section);
        }
      }

      if (suggestedSections.length === 0) {
        suggestedSections.push("延伸閱讀");
      }

      const baseScore = Math.max(0.5, 1 - index * 0.1);
      const typeBonus = this.getTypeRelevanceBonus(ref.type);
      const contextBonus = urlContext.length > 50 ? 0.1 : 0;
      const relevanceScore = Math.min(
        1,
        Math.round((baseScore + typeBonus + contextBonus) * 100) / 100,
      );

      return {
        url: ref.url,
        title: ref.title,
        type: ref.type,
        suggestedSections: [...new Set(suggestedSections)].slice(0, 3),
        relevanceScore,
      };
    });
  }

  private extractUrlContext(content: string, url: string): string {
    try {
      const domain = new URL(url).hostname;
      const domainPattern = new RegExp(
        `[^。！？\\n]*${domain.replace(/\./g, "\\.")}[^。！？\\n]*`,
        "gi",
      );
      const matches = content.match(domainPattern);
      return matches ? matches.join(" ") : "";
    } catch {
      return "";
    }
  }

  private getTypeRelevanceBonus(type: ExternalReference["type"]): number {
    const bonuses: Record<ExternalReference["type"], number> = {
      official_docs: 0.15,
      research: 0.12,
      wikipedia: 0.1,
      tutorial: 0.1,
      news: 0.08,
      industry: 0.08,
      service: 0.05,
      blog: 0.03,
    };
    return bonuses[type] || 0;
  }

  private parseUnifiedContent(
    content: string,
    citations: string[],
    executionTime: number,
  ): DeepResearchResult {
    const result: DeepResearchResult = {};

    const trendsMatch = content.match(
      /(?:最新趨勢|趨勢|Trends?)[\s\S]*?(?=(?:常見問題|FAQ|權威數據|$))/i,
    );
    if (trendsMatch) {
      result.trends = {
        content: trendsMatch[0].trim(),
        citations: citations.slice(0, 3),
        executionTime: Math.floor(executionTime / 3),
      };
    }

    const faqMatch = content.match(
      /(?:常見問題|FAQ|用戶.*?疑問)[\s\S]*?(?=(?:權威數據|統計|實用參考|$))/i,
    );
    if (faqMatch) {
      result.userQuestions = {
        content: faqMatch[0].trim(),
        citations: citations.slice(1, 4),
        executionTime: Math.floor(executionTime / 3),
      };
    }

    const dataMatch = content.match(
      /(?:權威數據|統計|數據|市場資訊)[\s\S]*?(?=(?:實用參考|來源|$))/i,
    );
    if (dataMatch) {
      result.authorityData = {
        content: dataMatch[0].trim(),
        citations: citations.slice(2, 5),
        executionTime: Math.floor(executionTime / 3),
      };
    }

    if (Object.keys(result).length === 0 && content.length > 100) {
      result.trends = {
        content: content.substring(0, Math.floor(content.length / 2)),
        citations: citations.slice(0, 3),
        executionTime: Math.floor(executionTime / 2),
      };
      result.userQuestions = {
        content: content.substring(Math.floor(content.length / 2)),
        citations: citations.slice(3),
        executionTime: Math.floor(executionTime / 2),
      };
    }

    return result;
  }

  private extractReferencesFromCitations(
    title: string,
    citations: string[],
    content: string,
  ): ExternalReference[] {
    if (!citations || citations.length === 0) {
      console.warn("[ResearchAgent] 無 citations，使用預設來源");
      return this.getDefaultExternalReferences(title);
    }

    const references: ExternalReference[] = [];

    for (let i = 0; i < Math.min(citations.length, 8); i++) {
      const url = citations[i];
      if (!url || typeof url !== "string") continue;

      try {
        const type = this.categorizeUrl(url);
        const domain = new URL(url).hostname;
        const urlContext = this.extractUrlContext(content, url);

        const baseScore = Math.max(0.5, 1 - i * 0.1);
        const typeBonus = this.getTypeRelevanceBonus(type);
        const contextBonus = urlContext.length > 50 ? 0.1 : 0;
        const relevance_score = Math.min(
          1,
          Math.round((baseScore + typeBonus + contextBonus) * 100) / 100,
        );

        references.push({
          url,
          title: this.extractTitleFromContent(url, content),
          type,
          domain,
          description: urlContext || `關於「${title}」的參考來源`,
          relevance_score,
        });
      } catch {
        console.warn("[ResearchAgent] 無效的 URL:", url);
      }
    }

    if (references.length === 0) {
      return this.getDefaultExternalReferences(title);
    }

    console.log("[ResearchAgent] 成功提取", references.length, "個外部引用");
    return references;
  }

  private async analyzeTitle(
    input: ResearchInput,
    researchData?: UnifiedResearchResult,
  ): Promise<
    Omit<
      ResearchOutput,
      | "title"
      | "region"
      | "externalReferences"
      | "referenceMapping"
      | "executionInfo"
    >
  > {
    const researchContext = researchData?.deepResearch
      ? `
## 已收集的研究資料（來自 Perplexity）

### 趨勢資訊
${researchData.deepResearch.trends?.content || "無"}

### 常見問題
${researchData.deepResearch.userQuestions?.content || "無"}

### 權威數據
${researchData.deepResearch.authorityData?.content || "無"}

### 參考來源（共 ${researchData.externalReferences?.length || 0} 個）
${
  researchData.externalReferences
    ?.slice(0, 5)
    .map((ref) => `- ${ref.title} (${ref.domain})`)
    .join("\n") || "無"
}
`
      : "";

    const prompt = `你是一位 SEO 專家，請針對文章標題「${input.title}」進行深入分析。

文章標題: ${input.title}
地區: ${input.region || "Taiwan"}
${researchContext}

基於上述研究資料，請分析以下項目：

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
   - 根據研究資料，列出競爭對手沒有深入探討的角度

4. **競爭對手分析** (competitorAnalysis):
   - 列出 3-5 個相關權威網站
   - 每個網站的標題、網域、字數估計
   - 優勢和弱點
   - 獨特切入角度

5. **推薦策略** (recommendedStrategy):
   - 基於研究資料和以上分析，提出內容創作建議

6. **相關關鍵字** (relatedKeywords):
   - 列出 5-10 個相關搜尋詞

請用結構化的方式回答，每個項目分開說明。`;

    console.log(
      "[ResearchAgent] 執行 AI 分析（使用 Perplexity 研究結果作為上下文）",
    );

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
    | "title"
    | "region"
    | "externalReferences"
    | "referenceMapping"
    | "executionInfo"
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

  private categorizeUrl(url: string): ExternalReference["type"] {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes("wikipedia.org")) return "wikipedia";

    if (
      lowerUrl.includes("github.com") ||
      lowerUrl.includes("docs.") ||
      lowerUrl.includes("/docs/") ||
      lowerUrl.includes("developer.") ||
      lowerUrl.includes("/api/")
    )
      return "official_docs";

    if (
      lowerUrl.includes("arxiv.org") ||
      lowerUrl.includes("scholar.google") ||
      lowerUrl.includes(".edu") ||
      lowerUrl.includes("researchgate") ||
      lowerUrl.includes("academia.edu")
    )
      return "research";

    if (
      lowerUrl.includes("techcrunch.com") ||
      lowerUrl.includes("wired.com") ||
      lowerUrl.includes("news") ||
      lowerUrl.includes("cnn.com") ||
      lowerUrl.includes("bbc.com") ||
      lowerUrl.includes("reuters.com") ||
      lowerUrl.includes("udn.com") ||
      lowerUrl.includes("ltn.com.tw") ||
      lowerUrl.includes("ettoday")
    )
      return "news";

    if (
      lowerUrl.includes("tutorial") ||
      lowerUrl.includes("howto") ||
      lowerUrl.includes("guide") ||
      lowerUrl.includes("learn") ||
      lowerUrl.includes("course") ||
      lowerUrl.includes("教學") ||
      lowerUrl.includes("指南")
    )
      return "tutorial";

    if (
      lowerUrl.includes("industry") ||
      lowerUrl.includes("trade") ||
      lowerUrl.includes("association") ||
      lowerUrl.includes("chamber") ||
      lowerUrl.includes("公會") ||
      lowerUrl.includes("協會")
    )
      return "industry";

    if (
      lowerUrl.includes("service") ||
      lowerUrl.includes("agency") ||
      lowerUrl.includes("studio") ||
      lowerUrl.includes("company") ||
      lowerUrl.includes("corp") ||
      lowerUrl.includes(".com.tw") ||
      lowerUrl.includes("shop") ||
      lowerUrl.includes("store")
    )
      return "service";

    return "blog";
  }

  /**
   * 從內容中提取標題（優先）或從 URL 提取（fallback）
   */
  private extractTitleFromContent(url: string, content: string): string {
    try {
      const domain = new URL(url).hostname.replace(/^www\./, "");

      // 1. 嘗試從內文找「標題」格式（在 URL/domain 附近）
      const patterns = [
        // 「標題」格式
        new RegExp(
          `「([^」]{4,60})」[^]*?${domain.replace(/\./g, "\\.")}`,
          "i",
        ),
        // "標題" 格式
        new RegExp(`"([^"]{4,60})"[^]*?${domain.replace(/\./g, "\\.")}`, "i"),
        // 《標題》格式
        new RegExp(
          `《([^》]{4,60})》[^]*?${domain.replace(/\./g, "\\.")}`,
          "i",
        ),
        // domain 前面的文字（可能是標題）
        new RegExp(
          `([\\u4e00-\\u9fa5a-zA-Z][^。！？\\n]{3,50})\\s*[（(]?${domain.replace(/\./g, "\\.")}`,
          "i",
        ),
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          const title = match[1].trim();
          // 過濾掉太短或看起來不像標題的結果
          if (title.length >= 4 && !this.isInvalidTitle(title)) {
            return title;
          }
        }
      }

      // 2. Fallback: 從 URL 路徑提取
      return this.extractTitleFromUrl(url);
    } catch {
      return this.extractTitleFromUrl(url);
    }
  }

  /**
   * 檢查是否為無效的標題
   */
  private isInvalidTitle(title: string): boolean {
    const invalidPatterns = [
      /^https?:\/\//i,
      /^www\./i,
      /^\d+$/,
      /^[h][1-6]$/i,
      /^(index|page|post|article|blog|news)$/i,
    ];
    return invalidPatterns.some((p) => p.test(title.trim()));
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/").filter((p) => p);

      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        // 過濾掉技術性詞彙
        const technicalTerms = new Set([
          "index",
          "page",
          "post",
          "article",
          "blog",
          "news",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
        ]);

        const words = lastPart
          .replace(/-/g, " ")
          .replace(/_/g, " ")
          .replace(/\.[^.]+$/, "")
          .split(" ")
          .filter((w) => w.length >= 2 && !technicalTerms.has(w.toLowerCase()));

        if (words.length > 0) {
          return words
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
        }
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
