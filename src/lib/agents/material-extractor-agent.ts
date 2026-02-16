/**
 * MaterialExtractor Agent
 * 從 Perplexity 研究結果 + WebFetch 補充中萃取結構化素材
 */
import { BaseAgent } from "./base-agent";
import type {
  DeepResearchResult,
  ExternalReference,
  MaterialsProfile,
} from "@/types/agents";
import {
  fetchArticleContent,
  isBlockedDomain,
  scoreUrl,
} from "@/lib/utils/web-fetcher";

interface MaterialExtractorInput {
  keyword: string;
  deepResearch: DeepResearchResult;
  externalReferences: ExternalReference[];
  targetLanguage: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export class MaterialExtractorAgent extends BaseAgent<
  MaterialExtractorInput,
  MaterialsProfile
> {
  get agentName(): string {
    return "MaterialExtractorAgent";
  }

  protected async process(
    input: MaterialExtractorInput,
  ): Promise<MaterialsProfile> {
    const { keyword, deepResearch, externalReferences, targetLanguage } = input;

    // Step 1: 評估 Perplexity 素材是否充足
    const perplexitySufficient = !this.needsWebFetch(deepResearch);
    console.log(
      `[MaterialExtractor] Perplexity sufficient: ${perplexitySufficient}`,
    );

    // Step 2: 收集所有素材文本
    let allContent = this.extractPerplexityContent(deepResearch);

    // Step 3: 如果 Perplexity 不夠，WebFetch 補充
    let fetchedUrls = 0;
    let totalUrls = 0;

    if (!perplexitySufficient && externalReferences.length > 0) {
      const urls = this.selectUrls(externalReferences, targetLanguage);
      totalUrls = urls.length;

      const MAX_TOTAL_CHARS = 8000;
      let totalChars = allContent.length;

      for (const ref of urls) {
        if (totalChars >= MAX_TOTAL_CHARS) break;

        console.log(`[MaterialExtractor] Fetching: ${ref.url}`);
        const content = await fetchArticleContent(ref.url);
        if (content) {
          const trimmed = content.substring(0, MAX_TOTAL_CHARS - totalChars);
          allContent += `\n\n--- Source: ${ref.url} ---\n${trimmed}`;
          totalChars += trimmed.length;
          fetchedUrls++;
        }
      }

      console.log(
        `[MaterialExtractor] Fetched ${fetchedUrls}/${totalUrls} URLs`,
      );
    }

    // Step 4: AI 萃取結構化素材
    if (allContent.length < 100) {
      return this.emptyProfile(perplexitySufficient, fetchedUrls, totalUrls);
    }

    const profile = await this.extractMaterials(
      keyword,
      allContent,
      input.model,
      input.temperature,
      input.maxTokens,
    );

    profile.meta = {
      fetchedUrls,
      totalUrls,
      perplexitySufficient,
      extractionModel: input.model,
    };

    return profile;
  }

  private needsWebFetch(deepResearch: DeepResearchResult): boolean {
    const content = [
      deepResearch.trends?.content || "",
      deepResearch.userQuestions?.content || "",
      deepResearch.authorityData?.content || "",
    ].join(" ");

    const hasPersonNames =
      /[A-Z][a-z]+|[\u4e00-\u9fa5]{2,4}(?:的|是|在|說|表示)/.test(content);
    const hasNumbers = (content.match(/\d+[%％萬億年月]/g) || []).length >= 3;
    const hasQuotes = /「[^」]+」|"[^"]+"/.test(content);

    return !(hasPersonNames && hasNumbers && hasQuotes);
  }

  private extractPerplexityContent(deepResearch: DeepResearchResult): string {
    return [
      deepResearch.trends?.content,
      deepResearch.userQuestions?.content,
      deepResearch.authorityData?.content,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private selectUrls(
    refs: ExternalReference[],
    targetLanguage: string,
  ): ExternalReference[] {
    return refs
      .filter((ref) => !isBlockedDomain(ref.url))
      .sort(
        (a, b) =>
          scoreUrl(b.url, targetLanguage, b.type) -
          scoreUrl(a.url, targetLanguage, a.type),
      )
      .slice(0, 5);
  }

  private async extractMaterials(
    keyword: string,
    content: string,
    model: string,
    temperature?: number,
    maxTokens?: number,
  ): Promise<MaterialsProfile> {
    const prompt = `你是一位內容研究專家。以下是與「${keyword}」相關的研究資料。
請從中提取可用於寫作的真實素材。

## 規則
1. 只提取有具體細節的內容（人名、數字、年份、事件）
2. 提取事實和數據點，不要複製原文句子
3. 每個素材標記來源
4. 金句需保留原文措辭（這是引用，非抄襲）
5. 案例需包含具體經過和結果
6. 對每個統計數據，標明年份（如果原文有提及）
7. 對每個素材，標記 relevantTopics（2-3 個關鍵主題詞）
8. 如果無法確定數據年份，標記 confidence 為 'uncertain'

## 研究資料
${content.substring(0, 12000)}

請輸出 JSON 格式的 MaterialsProfile，結構如下：
{
  "stories": [{ "subject": "", "narrative": "", "source": "", "relevantTopics": [] }],
  "statistics": [{ "fact": "", "source": "", "year": null, "confidence": "verified|inferred|uncertain" }],
  "quotes": [{ "text": "", "speaker": "", "source": "", "relevantTopics": [] }],
  "cases": [{ "title": "", "description": "", "outcome": "success|failure|mixed", "source": "", "timeframe": "", "relevantTopics": [] }],
  "experts": [{ "name": "", "title": "", "relevance": "" }]
}

只輸出 JSON，不要用 \`\`\`json 包裹。`;

    const response = await this.complete(prompt, {
      model,
      temperature: temperature || 0.3,
      maxTokens: maxTokens || 4000,
      format: "json",
    });

    try {
      let parsed = JSON.parse(response.content.trim());
      // Handle wrapped format
      if (parsed.materials) parsed = parsed.materials;
      return this.validateProfile(parsed);
    } catch {
      console.warn("[MaterialExtractor] JSON parse failed, returning empty");
      return this.emptyProfile(false, 0, 0);
    }
  }

  private validateProfile(raw: Record<string, unknown>): MaterialsProfile {
    return {
      stories: Array.isArray(raw.stories) ? raw.stories : [],
      statistics: Array.isArray(raw.statistics) ? raw.statistics : [],
      quotes: Array.isArray(raw.quotes) ? raw.quotes : [],
      cases: Array.isArray(raw.cases) ? raw.cases : [],
      experts: Array.isArray(raw.experts) ? raw.experts : [],
      meta: {
        fetchedUrls: 0,
        totalUrls: 0,
        perplexitySufficient: false,
        extractionModel: "",
      },
    };
  }

  private emptyProfile(
    perplexitySufficient: boolean,
    fetchedUrls: number,
    totalUrls: number,
  ): MaterialsProfile {
    return {
      stories: [],
      statistics: [],
      quotes: [],
      cases: [],
      experts: [],
      meta: {
        fetchedUrls,
        totalUrls,
        perplexitySufficient,
        extractionModel: "",
      },
    };
  }
}
