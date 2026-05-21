import { BaseAgent } from "./base-agent";
import type {
  StrategyInput,
  StrategyOutput,
  ImageGuidance,
} from "@/types/agents";
import { buildLanguageInstructions } from "./prompt-utils";

/** 各語系的圖片文字範例（用於 AI prompt 引導） */
const LOCALE_IMAGE_TEXT_EXAMPLES: Record<string, string[]> = {
  "zh-TW": ["專家指南", "實用技巧", "重點整理", "必學秘訣"],
  "zh-CN": ["专家指南", "实用技巧", "重点整理", "必学秘诀"],
  "ja-JP": ["専門ガイド", "実用テクニック", "重要ポイント", "必須知識"],
  "ko-KR": ["전문 가이드", "실용 팁", "핵심 정리", "필수 지식"],
  "en-US": ["Expert Guide", "Pro Tips", "Key Insights", "Best Practice"],
  "de-DE": [
    "Expertenführer",
    "Profi-Tipps",
    "Wichtige Punkte",
    "Best Practice",
  ],
  "es-ES": [
    "Guía Experta",
    "Consejos Pro",
    "Puntos Clave",
    "Mejores Prácticas",
  ],
  "fr-FR": [
    "Guide Expert",
    "Astuces Pro",
    "Points Clés",
    "Meilleures Pratiques",
  ],
};

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return "StrategyAgent";
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const titleOptions = await this.generateTitleOptions(input);

    // 完全由 AI 生成標題，用戶輸入的關鍵字只作為主題參考
    const selectedTitle = await this.selectBestTitle(titleOptions, input);

    const outline = await this.generateOutline(input, selectedTitle);

    const sectionDistribution = this.calculateWordDistribution(
      input.targetWordCount,
      outline,
    );

    // 生成圖片指引（風格和文字建議）
    const imageGuidance = await this.generateImageGuidance(
      input,
      selectedTitle,
      outline,
    );

    return {
      titleOptions,
      selectedTitle,
      outline,
      targetWordCount: input.targetWordCount,
      sectionWordDistribution: sectionDistribution,
      keywordDensityTarget: 0,
      keywords: input.researchData.relatedKeywords || [],
      relatedKeywords: input.researchData.relatedKeywords,
      lsiKeywords: input.researchData.relatedKeywords.slice(0, 5),
      internalLinkingStrategy: {
        targetSections: outline.mainSections.map((s) => s.heading),
        suggestedTopics: input.researchData.contentGaps.slice(0, 3),
        minLinks: 3,
      },
      differentiationStrategy: {
        uniqueAngles: input.researchData.contentGaps,
        valueProposition: input.researchData.recommendedStrategy,
        competitiveAdvantages: ["深入分析", "實用建議", "最新資訊"],
      },
      externalReferences: input.researchData.externalReferences,
      imageGuidance, // 新增圖片指引
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateTitleOptions(input: StrategyInput): Promise<string[]> {
    const recommendedStrategy = input.researchData.recommendedStrategy || "";
    const contentGaps = input.researchData.contentGaps || [];
    const searchIntent = input.researchData.searchIntent || "informational";

    const targetLang = input.targetLanguage || "zh-TW";
    const titleLengthRange = this.getTitleLengthRange(targetLang);

    const langInstructions = buildLanguageInstructions(targetLang);

    const prompt = `You are an SEO expert. Generate 3 original titles for the topic "${input.researchData.title}".

${langInstructions}

## Research Context
- Strategy: ${recommendedStrategy || "Provide professional, practical content"}
- Search Intent: ${searchIntent}
- Content Gaps: ${contentGaps.length > 0 ? contentGaps.slice(0, 3).join("; ") : "None identified"}

## Title Quality Standards
1. Each title must contain: a specific number OR action verb OR reader pain point
2. Titles must be newly created — do not copy the keyword directly
3. Length: ${titleLengthRange.min}-${titleLengthRange.max} characters
4. Generate 3 different styles (question, number-based, benefit-focused)
5. No years, no "Complete Guide/Ultimate/攻略/指南", no placeholders

## Output Format (JSON only)
{
  "titles": ["Title 1", "Title 2", "Title 3"]
}`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.6,
        maxTokens: Math.min(input.maxTokens || 64000, 1000),
        format: "json",
      });

      console.log("[StrategyAgent] Raw title response:", {
        contentLength: response.content?.length || 0,
        preview: response.content?.substring(0, 200),
      });

      if (!response.content || response.content.trim() === "") {
        console.warn("[StrategyAgent] Empty response, using fallback titles");
        return this.getFallbackTitles(
          input.researchData.title,
          input.targetLanguage,
        );
      }

      const content = response.content.trim();

      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            const validTitles = this.filterValidTitles(
              parsed.slice(0, 3),
              input.researchData.title,
              input.targetLanguage,
            );
            console.log(
              "[StrategyAgent] Successfully parsed titles from array match",
            );
            return validTitles;
          }
        } catch (e) {
          console.warn("[StrategyAgent] Failed to parse array match:", e);
        }
      }

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          const validTitles = this.filterValidTitles(
            parsed.slice(0, 3),
            input.researchData.title,
            input.targetLanguage,
          );
          console.log(
            "[StrategyAgent] Successfully parsed titles from full content",
          );
          return validTitles;
        }
        if (
          parsed.titles &&
          Array.isArray(parsed.titles) &&
          parsed.titles.length >= 3
        ) {
          const validTitles = this.filterValidTitles(
            parsed.titles.slice(0, 3),
            input.researchData.title,
            input.targetLanguage,
          );
          console.log(
            "[StrategyAgent] Successfully parsed titles from .titles property",
            {
              reasoning: parsed.reasoning_summary?.substring(0, 100),
              titlesCount: validTitles.length,
            },
          );
          return validTitles;
        }
      } catch (e) {
        console.warn(
          "[StrategyAgent] Failed to parse full content as JSON:",
          e,
        );
      }

      console.warn(
        "[StrategyAgent] Invalid title format, trying research-based generation",
      );
      if (input.researchData.deepResearch) {
        return await this.generateTitlesFromResearch(
          input.researchData.title,
          input.researchData.deepResearch,
          input.model,
          input.targetLanguage,
        );
      }
      return this.getFallbackTitles(
        input.researchData.title,
        input.targetLanguage,
      );
    } catch (error) {
      console.error("[StrategyAgent] Title generation failed:", error);
      if (input.researchData.deepResearch) {
        return await this.generateTitlesFromResearch(
          input.researchData.title,
          input.researchData.deepResearch,
          input.model,
          input.targetLanguage,
        );
      }
      return this.getFallbackTitles(
        input.researchData.title,
        input.targetLanguage,
      );
    }
  }

  private getFallbackTitles(
    keyword: string,
    targetLanguage?: string,
  ): string[] {
    const isEnglish = targetLanguage?.startsWith("en") || false;

    const templates = isEnglish
      ? [
          [
            `Why ${keyword} Matters: Expert Insights`,
            `The Truth About ${keyword}: 5 Things You Should Know`,
            `${keyword} for Beginners: Essential Tips`,
          ],
          [
            `${keyword} Myths Debunked: What Really Works`,
            `How to Get Better Results with ${keyword}`,
            `${keyword} Pro Tips: Insider Secrets`,
          ],
          [
            `How to Choose the Right ${keyword}: Expert Guide`,
            `${keyword} on a Budget: Smart Strategies`,
            `${keyword} Trends: What's Next`,
          ],
        ]
      : [
          [
            `為什麼${keyword}如此重要？專家這樣說`,
            `${keyword}背後的秘密：你不知道的5件事`,
            `${keyword}新手必讀：少走彎路的關鍵`,
          ],
          [
            `${keyword}的真相：打破常見迷思`,
            `這樣做${keyword}效果翻倍`,
            `${keyword}達人的私房心得`,
          ],
          [
            `${keyword}怎麼選？專業評測報告`,
            `${keyword}省錢攻略：聰明消費者必看`,
            `${keyword}趨勢觀察：未來發展方向`,
          ],
        ];

    const templateSet = templates[Math.floor(Math.random() * templates.length)];
    console.log(
      `[StrategyAgent] Using fallback titles (language: ${targetLanguage || "zh-TW"})`,
    );
    return templateSet;
  }

  private async generateTitlesFromResearch(
    keyword: string,
    researchData: {
      trends?: { content: string };
      userQuestions?: { content: string };
    },
    model: string,
    targetLanguage?: string,
  ): Promise<string[]> {
    const trendsContent = researchData.trends?.content || "";
    const questionsContent = researchData.userQuestions?.content || "";

    if (!trendsContent && !questionsContent) {
      return this.getFallbackTitles(keyword, targetLanguage);
    }

    const langInstructions = buildLanguageInstructions(
      targetLanguage || "zh-TW",
    );
    const isEnglish = targetLanguage?.startsWith("en") || false;
    const lengthGuide = isEnglish ? "50-80 characters" : "20-40 個中文字";

    const prompt = `Generate 3 compelling article titles for "${keyword}" based on research data.

${langInstructions}

## Research Data
- Trends: ${trendsContent.substring(0, 500) || "N/A"}
- User Questions: ${questionsContent.substring(0, 500) || "N/A"}

## Requirements
1. Reflect research findings, use natural language
2. Length: ${lengthGuide}
3. No years, no "Complete Guide/Ultimate", no exaggeration

## Output Format
["Title 1", "Title 2", "Title 3"]`;

    try {
      const response = await this.complete(prompt, {
        model,
        temperature: 0.7,
        maxTokens: 500,
        format: "json",
      });

      if (!response.content) {
        return this.getFallbackTitles(keyword, targetLanguage);
      }

      const content = response.content.trim();
      const arrayMatch = content.match(/\[[\s\S]*?\]/);

      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed
            .slice(0, 3)
            .filter(
              (t: unknown): t is string =>
                typeof t === "string" &&
                t.length >= 10 &&
                !this.containsPlaceholder(t),
            );
        }
      }

      return this.getFallbackTitles(keyword, targetLanguage);
    } catch (error) {
      console.warn(
        "[StrategyAgent] AI title generation failed, using fallback:",
        error,
      );
      return this.getFallbackTitles(keyword, targetLanguage);
    }
  }

  private containsPlaceholder(text: string): boolean {
    const placeholderPatterns = [
      /<[^>]*標題[^>]*>/,
      /<[^>]*章節[^>]*>/,
      /<[^>]*問題[^>]*>/,
      /<[^>]*答案[^>]*>/,
      /\[[^\]]*標題[^\]]*\]/,
      /\[[^\]]*章節[^\]]*\]/,
      /\{[^}]*標題[^}]*\}/,
      /<你[^>]+>/,
      /<第[一二三四五六七八九十]+[^>]*>/,
      /placeholder/i,
      /\[insert\s/i,
      /\[your\s/i,
    ];
    return placeholderPatterns.some((pattern) => pattern.test(text));
  }

  private filterValidTitles(
    titles: string[],
    fallbackTitle: string,
    targetLanguage?: string,
  ): string[] {
    const validTitles = titles.filter((t) => {
      if (!t || typeof t !== "string" || t.trim().length < 5) return false;
      if (this.containsPlaceholder(t)) {
        console.warn("[StrategyAgent] Filtered out placeholder title:", t);
        return false;
      }
      return true;
    });

    if (validTitles.length < 3) {
      console.warn("[StrategyAgent] Not enough valid titles, using fallback", {
        valid: validTitles.length,
        original: titles.length,
      });
      return this.getFallbackTitles(fallbackTitle, targetLanguage);
    }

    return validTitles;
  }

  private async selectBestTitle(
    titleOptions: string[],
    input: StrategyInput,
  ): Promise<string> {
    if (titleOptions.length === 0) {
      return input.researchData.title;
    }

    if (titleOptions.length === 1) {
      return titleOptions[0];
    }

    const scores = titleOptions.map((title) =>
      this.scoreTitleSEO(title, input),
    );
    const bestIndex = scores.indexOf(Math.max(...scores));

    console.log(
      "[StrategyAgent] Title scores:",
      titleOptions.map((t, i) => ({
        title: t.substring(0, 30) + "...",
        score: scores[i],
      })),
    );
    console.log(
      "[StrategyAgent] Selected best title:",
      titleOptions[bestIndex],
    );

    return titleOptions[bestIndex];
  }

  private getTitleLengthRange(targetLang: string): {
    min: number;
    max: number;
  } {
    if (targetLang.startsWith("zh")) {
      return { min: 20, max: 35 };
    }
    return { min: 50, max: 60 };
  }

  private scoreTitleSEO(title: string, input: StrategyInput): number {
    let score = 0;
    const keyword = (input.researchData.title || "").toLowerCase();

    // 關鍵字匹配 (35分)
    if (
      title
        .toLowerCase()
        .includes(keyword.substring(0, Math.min(keyword.length, 10)))
    ) {
      score += 35;
    }

    // 標題長度 (25分)
    const targetLang = input.targetLanguage || "zh-TW";
    const { min, max } = this.getTitleLengthRange(targetLang);
    const length = title.length;

    if (length >= min && length <= max) {
      score += 25;
    } else if (length >= min - 5 && length <= max + 10) {
      score += 15;
    }

    // Power Words (20分)
    const powerWords = ["最新", "專業", "實用", "必學", "精選", "秘訣", "技巧"];
    for (const word of powerWords) {
      if (title.includes(word)) {
        score += 20;
        break;
      }
    }

    // 數字使用 (20分)
    if (/\d+/.test(title)) {
      score += 20;
    }

    score = Math.min(score, 100);

    console.log("[StrategyAgent] Title SEO score:", {
      title: title.substring(0, 30) + "...",
      score,
    });

    return score;
  }

  private async generateOutline(
    input: StrategyInput,
    selectedTitle: string,
  ): Promise<StrategyOutput["outline"]> {
    try {
      const targetLang = input.targetLanguage || "zh-TW";
      const langInstructions = buildLanguageInstructions(targetLang);

      const prompt = `Generate a structured outline for "${selectedTitle}".

${langInstructions}
Target word count: ${input.targetWordCount}
Search intent: ${input.researchData.searchIntent}
Content gaps: ${input.researchData.contentGaps.slice(0, 3).join(", ")}

**Output this exact JSON structure** (fill in real content):

{
  "introduction": {
    "hook": "An engaging opening question or data point",
    "context": "Why this topic matters to the reader",
    "thesis": "What the reader will learn",
    "wordCount": 120
  },
  "mainSections": [
    {
      "heading": "A specific, actionable H2 with numbers or verbs",
      "subheadings": ["Concrete subtopic 1", "Concrete subtopic 2"],
      "keyPoints": ["Key insight 1", "Key insight 2"],
      "targetWordCount": 150,
      "keywords": ["relevant keyword 1", "relevant keyword 2"]
    }
  ],
  "conclusion": {
    "summary": "Core takeaway",
    "callToAction": "Next step for the reader",
    "wordCount": 100
  },
  "faq": [
    { "question": "A real user question", "answerOutline": "Brief answer direction" }
  ]
}

**Rules**:
1. mainSections: 2-4 items, each heading must include specific numbers/action verbs/reader pain points
2. Each section targetWordCount ≤ 150 (concise and focused)
3. Total targetWordCount ≈ ${input.targetWordCount}
4. FAQ section is generated separately — do NOT include FAQ/troubleshooting in mainSections
5. Output JSON directly, no \`\`\`json wrapper`;

      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.1, // 降低溫度提高一致性
        maxTokens: Math.min(input.maxTokens || 64000, 2000),
        format: "json",
      });

      console.log("[StrategyAgent] AI response received:", {
        contentLength: response.content.length,
        preview: response.content.substring(0, 200),
      });

      // 驗證並解析 JSON
      const parsed = this.validateAndParseOutline(response.content);

      if (parsed) {
        console.log(
          "[StrategyAgent] ✅ Successfully generated and validated outline from AI",
        );
        return parsed;
      }

      throw new Error("AI generated outline failed validation");
    } catch (error) {
      console.warn(
        "[StrategyAgent] AI outline generation failed, using fallback:",
        error,
      );
      return this.getFallbackOutline(selectedTitle, input.targetWordCount);
    }
  }

  /**
   * 定義 Outline 的 JSON Schema（DeepSeek structured outputs）
   */
  private getOutlineSchema() {
    return {
      type: "object",
      required: ["introduction", "mainSections", "conclusion", "faq"],
      properties: {
        introduction: {
          type: "object",
          required: ["hook", "context", "thesis", "wordCount"],
          properties: {
            hook: { type: "string", description: "吸引讀者的開場方式" },
            context: { type: "string", description: "背景說明" },
            thesis: { type: "string", description: "主要觀點" },
            wordCount: { type: "number", description: "字數（約 100-120）" },
          },
        },
        mainSections: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "object",
            required: [
              "heading",
              "subheadings",
              "keyPoints",
              "targetWordCount",
              "keywords",
            ],
            properties: {
              heading: { type: "string", description: "章節標題" },
              subheadings: {
                type: "array",
                items: { type: "string" },
                description: "子標題（2-3個）",
              },
              keyPoints: {
                type: "array",
                items: { type: "string" },
                description: "重點（2-4個）",
              },
              targetWordCount: {
                type: "number",
                description: "目標字數（上限 150）",
              },
              keywords: {
                type: "array",
                items: { type: "string" },
                description: "關鍵字（2-5個）",
              },
            },
          },
        },
        conclusion: {
          type: "object",
          required: ["summary", "callToAction", "wordCount"],
          properties: {
            summary: { type: "string", description: "總結重點" },
            callToAction: { type: "string", description: "行動呼籲" },
            wordCount: { type: "number", description: "字數（約 80-100）" },
          },
        },
        faq: {
          type: "array",
          minItems: 3,
          maxItems: 5,
          items: {
            type: "object",
            required: ["question", "answerOutline"],
            properties: {
              question: { type: "string", description: "常見問題" },
              answerOutline: { type: "string", description: "答案大綱" },
            },
          },
        },
      },
    };
  }

  /**
   * 驗證並解析 AI 返回的 JSON（客戶端 schema 驗證）
   */
  private validateAndParseOutline(
    content: string,
  ): StrategyOutput["outline"] | null {
    try {
      // 清理可能的 markdown 包裹
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent
          .replace(/^```json\s*\n?/, "")
          .replace(/\n?```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent
          .replace(/^```\s*\n?/, "")
          .replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleanContent);

      // 基本結構驗證
      if (
        !parsed.introduction ||
        !parsed.mainSections ||
        !parsed.conclusion ||
        !parsed.faq
      ) {
        console.warn("[StrategyAgent] Missing required fields in outline");
        return null;
      }

      if (
        !Array.isArray(parsed.mainSections) ||
        parsed.mainSections.length < 2 ||
        parsed.mainSections.length > 4
      ) {
        console.warn(
          "[StrategyAgent] Invalid mainSections array length:",
          parsed.mainSections?.length,
        );
        return null;
      }

      // 驗證每個 section 的必要欄位與佔位符
      for (const section of parsed.mainSections) {
        if (
          !section.heading ||
          !section.subheadings ||
          !section.keyPoints ||
          !section.targetWordCount ||
          !section.keywords
        ) {
          console.warn(
            "[StrategyAgent] Section missing required fields:",
            section,
          );
          return null;
        }

        if (this.containsPlaceholder(section.heading)) {
          console.warn(
            "[StrategyAgent] Section heading contains placeholder:",
            section.heading,
          );
          return null;
        }

        for (const sub of section.subheadings) {
          if (this.containsPlaceholder(sub)) {
            console.warn(
              "[StrategyAgent] Subheading contains placeholder:",
              sub,
            );
            return null;
          }
        }
      }

      // 驗證 FAQ
      if (!Array.isArray(parsed.faq) || parsed.faq.length < 2) {
        console.warn("[StrategyAgent] Invalid faq array");
        return null;
      }

      for (const faq of parsed.faq) {
        if (this.containsPlaceholder(faq.question)) {
          console.warn(
            "[StrategyAgent] FAQ question contains placeholder:",
            faq.question,
          );
          return null;
        }
      }

      console.log("[StrategyAgent] ✅ Outline validation passed");
      return parsed as StrategyOutput["outline"];
    } catch (error) {
      console.warn("[StrategyAgent] JSON parsing/validation failed:", error);
      return null;
    }
  }

  /**
   * 建構競品排除清單（Plan C: 競品差異化）
   */
  private buildCompetitorExclusionList(
    researchData: StrategyInput["researchData"],
  ): string {
    const exclusions: string[] = [];

    // 從競品分析中提取標題
    if (researchData.competitorAnalysis?.length > 0) {
      const competitorTitles = researchData.competitorAnalysis
        .slice(0, 5)
        .map((c) => c.title)
        .filter(Boolean);
      if (competitorTitles.length > 0) {
        exclusions.push(...competitorTitles);
      }
    }

    // 從結構模式中提取常見 H2
    if (researchData.topRankingFeatures?.structurePatterns?.length > 0) {
      exclusions.push(
        ...researchData.topRankingFeatures.structurePatterns.slice(0, 5),
      );
    }

    // 從常見主題中提取
    if (researchData.topRankingFeatures?.commonTopics?.length > 0) {
      exclusions.push(
        ...researchData.topRankingFeatures.commonTopics.slice(0, 3),
      );
    }

    if (exclusions.length === 0) {
      return "";
    }

    // 去重並限制數量
    const uniqueExclusions = [...new Set(exclusions)].slice(0, 10);

    return `**🚫 競品已使用的標題/結構（禁止相似）**：
${uniqueExclusions.map((e) => `- ❌ ${e}`).join("\n")}

你的標題必須與以上完全不同，提供獨特視角。`;
  }

  /**
   * 建構大綱生成 Prompt（簡化版，更容易生成有效 JSON）
   */
  private buildOutlinePrompt(
    title: string,
    input: StrategyInput,
    competitors: any[],
    gaps: string[],
    retryAttempt: number = 0,
  ): string {
    // 第一次嘗試使用完整說明，重試時使用更簡潔的版本
    const isRetry = retryAttempt > 0;

    return `為文章「${title}」生成大綱。${isRetry ? "\n\n⚠️ 請務必輸出有效的 JSON 格式，直接以 { 開頭，} 結尾。" : ""}

目標字數：${input.targetWordCount}
搜尋意圖：${input.researchData.searchIntent}

${
  !isRetry
    ? `內容缺口：
${gaps
  .slice(0, 2)
  .map((g, i) => `${i + 1}. ${g}`)
  .join("\n")}

`
    : ""
}**JSON 輸出格式（必須完全遵守）：**

{
  "introduction": {
    "hook": "用一個引人入勝的問題或數據開場",
    "context": "說明這個主題的重要性和背景",
    "thesis": "本文將帶你了解...",
    "wordCount": 200
  },
  "mainSections": [
    {
      "heading": "[根據主題自行創作獨特且具體的標題]",
      "subheadings": ["[根據該段落內容創作小標題]", "[另一個具體小標題]"],
      "keyPoints": ["[該段落的關鍵重點]", "[另一個關鍵重點]"],
      "targetWordCount": 500,
      "keywords": ["[與該段落相關的關鍵字]"]
    },
    {
      "heading": "[另一個獨特且具體的標題，不可與上一個重複]",
      "subheadings": ["[具體小標題]", "[具體小標題]"],
      "keyPoints": ["[關鍵重點]", "[關鍵重點]"],
      "targetWordCount": 500,
      "keywords": ["[相關關鍵字]"]
    }
  ],
  "conclusion": {
    "summary": "回顧本文重點...",
    "callToAction": "現在就開始...",
    "wordCount": 150
  },
  "faq": [
    {
      "question": "這個方法適合新手嗎？",
      "answerOutline": "適合，因為..."
    }
  ]
}

**重要禁止事項**：
- ❌ 禁止使用 <...>、[...]、{...} 等佔位符格式
- ❌ 禁止使用「標題1」「子標題1」「常見問題1」等編號佔位符
- ✅ 必須輸出具體、有意義的完整內容

**H2 標題品質標準**：
- ✅ 包含具體數字（如「3 個關鍵步驟」「5 分鐘學會」）
- ✅ 使用動作動詞（如「打造」「避免」「提升」）
- ✅ 點出讀者痛點（如「為什麼你的 XX 總是失敗」）
- ✅ 提供獨特視角，與競品不同

${this.buildCompetitorExclusionList(input.researchData)}

**規則：**
1. mainSections 2-4 個
2. 標題必須具體、吸引人、與主題「${input.title}」直接相關
3. 標題要有獨特角度，避免與競品雷同
4. 直接輸出 JSON，不要用 \`\`\`json 包裹
5. 確保 JSON 格式正確

現在請直接輸出 JSON：`;
  }

  private parseOutlineWithFallbacks(
    content: string,
    title: string,
    targetWordCount: number,
  ): StrategyOutput["outline"] {
    // Log AI response details for debugging
    console.log("[StrategyAgent] AI Response Analysis:", {
      totalLength: content.length,
      firstChars: content.substring(0, 200),
      lastChars: content.substring(Math.max(0, content.length - 200)),
      hasMarkdownCodeBlock:
        content.includes("```json") || content.includes("```"),
      hasJsonBraces: content.includes("{") && content.includes("}"),
      startsWithBrace: content.trim().startsWith("{"),
    });

    const parsers: Array<{
      name: string;
      parse: () => StrategyOutput["outline"] | null;
    }> = [
      {
        name: "DirectJSONParser",
        parse: () => this.tryDirectJSONParse(content),
      },
      {
        name: "MarkdownCodeBlockParser",
        parse: () => this.tryMarkdownCodeBlockParse(content),
      },
      {
        name: "NestedJSONParser",
        parse: () => this.tryNestedJSONParse(content),
      },
      {
        name: "MarkdownStructuredParser",
        parse: () => this.parseOutlineText(content, title, targetWordCount),
      },
      {
        name: "FallbackOutline",
        parse: () => this.getFallbackOutline(title, targetWordCount),
      },
    ];

    for (const parser of parsers) {
      try {
        console.log(`[StrategyAgent] Attempting parser: ${parser.name}`);
        const result = parser.parse();

        if (result && result.mainSections && result.mainSections.length > 0) {
          console.log(`[StrategyAgent] ✅ ${parser.name} succeeded:`, {
            sectionsCount: result.mainSections.length,
            sectionTitles: result.mainSections
              .map((s) => s.heading)
              .slice(0, 3),
          });
          return result;
        }

        console.warn(
          `[StrategyAgent] ⚠️ ${parser.name} returned empty or invalid result`,
        );
      } catch (error) {
        const err = error as Error;
        console.warn(`[StrategyAgent] ❌ ${parser.name} failed:`, {
          errorMessage: err.message,
          errorName: err.name,
        });
      }
    }

    console.error("[StrategyAgent] All parsers failed, using fallback outline");
    return this.getFallbackOutline(title, targetWordCount);
  }

  private tryDirectJSONParse(
    content: string,
  ): StrategyOutput["outline"] | null {
    try {
      const parsed = JSON.parse(content);
      if (parsed.mainSections) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  private tryMarkdownCodeBlockParse(
    content: string,
  ): StrategyOutput["outline"] | null {
    // Try to extract JSON from Markdown code blocks like ```json...``` or ```{...}```
    const codeBlockPatterns = [
      /```json\s*\n?([\s\S]*?)\n?```/, // ```json ... ```
      /```\s*\n?(\{[\s\S]*?\})\n?```/, // ``` {...} ```
    ];

    for (const pattern of codeBlockPatterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1].trim());

          if (parsed.outline?.mainSections) {
            console.log(
              "[StrategyAgent] Extracted JSON from Markdown code block (nested)",
            );
            return parsed.outline;
          }

          if (parsed.mainSections) {
            console.log(
              "[StrategyAgent] Extracted JSON from Markdown code block (direct)",
            );
            return parsed;
          }
        } catch (error) {
          console.warn(
            "[StrategyAgent] Failed to parse Markdown code block content:",
            error,
          );
        }
      }
    }

    return null;
  }

  private tryNestedJSONParse(
    content: string,
  ): StrategyOutput["outline"] | null {
    // 嘗試多種 JSON 提取策略
    const extractionStrategies = [
      // 策略 1: 找到最後一個完整的 JSON 物件（最可能是輸出結果）
      () => {
        const matches = content.matchAll(/\{[\s\S]*?\}/g);
        const allMatches = Array.from(matches);
        if (allMatches.length === 0) return null;

        // 從最後一個 match 開始往前試
        for (let i = allMatches.length - 1; i >= 0; i--) {
          try {
            const parsed = JSON.parse(allMatches[i][0]);
            if (parsed.mainSections || parsed.outline?.mainSections) {
              console.log(
                `[StrategyAgent] Found valid JSON at match ${i + 1}/${allMatches.length}`,
              );
              return parsed;
            }
          } catch {
            continue;
          }
        }
        return null;
      },

      // 策略 2: 找到最大的 JSON 物件（最可能包含完整資訊）
      () => {
        const matches = content.matchAll(/\{[\s\S]*?\}/g);
        const allMatches = Array.from(matches);
        if (allMatches.length === 0) return null;

        // 按長度排序，從最長的開始試
        const sortedByLength = allMatches.sort(
          (a, b) => b[0].length - a[0].length,
        );
        for (const match of sortedByLength) {
          try {
            const parsed = JSON.parse(match[0]);
            if (parsed.mainSections || parsed.outline?.mainSections) {
              console.log(
                `[StrategyAgent] Found valid JSON with length ${match[0].length}`,
              );
              return parsed;
            }
          } catch {
            continue;
          }
        }
        return null;
      },

      // 策略 3: 使用貪婪匹配，嘗試找到最外層的 JSON（原本的邏輯）
      () => {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;

        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          return null;
        }
      },
    ];

    for (let i = 0; i < extractionStrategies.length; i++) {
      try {
        const parsed = extractionStrategies[i]();
        if (!parsed) continue;

        if (parsed.outline?.mainSections) {
          console.log(
            `[StrategyAgent] ✅ Extraction strategy ${i + 1} succeeded (nested structure)`,
          );
          return parsed.outline;
        }

        if (parsed.mainSections) {
          console.log(
            `[StrategyAgent] ✅ Extraction strategy ${i + 1} succeeded (direct structure)`,
          );
          return parsed;
        }
      } catch (error) {
        console.warn(
          `[StrategyAgent] Extraction strategy ${i + 1} failed:`,
          error,
        );
        continue;
      }
    }

    console.warn("[StrategyAgent] All JSON extraction strategies failed");
    return null;
  }

  private parseOutlineText(
    content: string,
    title: string,
    targetWordCount: number,
  ): StrategyOutput["outline"] {
    console.log("[StrategyAgent] parseOutlineText called", {
      contentLength: content.length,
      hasFrontmatter:
        content.includes("### 前言") || content.includes("Introduction"),
      hasMainSections:
        content.includes("### 主要段落") || content.includes("Main Sections"),
      hasConclusion:
        content.includes("### 結論") || content.includes("Conclusion"),
    });

    const introMatch = content.match(/### 前言[\s\S]*?(?=###|$)/);
    const mainMatch = content.match(/### 主要段落[\s\S]*?(?=### 結論|$)/);
    const conclusionMatch = content.match(/### 結論[\s\S]*?(?=### 常見問題|$)/);
    const faqMatch = content.match(/### 常見問題[\s\S]*$/);

    console.log("[StrategyAgent] Section matches:", {
      introFound: !!introMatch,
      mainFound: !!mainMatch,
      conclusionFound: !!conclusionMatch,
      faqFound: !!faqMatch,
      mainMatchLength: mainMatch?.[0]?.length || 0,
    });

    const extractListItems = (text: string): string[] => {
      const items: string[] = [];
      const lines = text.split("\n");
      for (const line of lines) {
        const match = line.match(/[-•]\s*(.+?)[：:]\s*(.+)/);
        if (match && match[2]) {
          items.push(match[2].trim().replace(/\[|\]/g, ""));
        }
      }
      return items;
    };

    const introduction = introMatch
      ? {
          hook: extractListItems(introMatch[0])[0] || `${title}為什麼重要？`,
          context: extractListItems(introMatch[0])[1] || `${title}的背景說明`,
          thesis:
            extractListItems(introMatch[0])[2] ||
            `本文將深入探討${title}的各個面向`,
          wordCount: 200,
        }
      : {
          hook: `${title}為什麼重要？`,
          context: `${title}的背景說明`,
          thesis: `本文將深入探討${title}的各個面向`,
          wordCount: 200,
        };

    const mainSections: Array<{
      heading: string;
      subheadings: string[];
      keyPoints: string[];
      targetWordCount: number;
      keywords: string[];
    }> = [];

    if (mainMatch) {
      const sectionBlocks = mainMatch[0].split(/- 段落標題/).slice(1);
      const sectionWordCount = Math.floor(
        (targetWordCount - 350) / Math.min(sectionBlocks.length, 4),
      );

      console.log("[StrategyAgent] Parsing main sections:", {
        sectionBlocksCount: sectionBlocks.length,
        firstBlockPreview: sectionBlocks[0]?.substring(0, 100),
      });

      for (let i = 0; i < Math.min(sectionBlocks.length, 4); i++) {
        const block = sectionBlocks[i];
        const headingMatch = block.match(/[：:]\s*(.+?)(?:\n|$)/);
        const subheadingsMatch = block.match(/- 子標題[：:]\s*(.+?)(?:\n|$)/);
        const keyPointsMatch = block.match(/- 關鍵重點[：:]\s*(.+?)(?:\n|$)/);
        const keywordsMatch = block.match(/- 相關關鍵字[：:]\s*(.+?)(?:\n|$)/);

        const section = {
          heading: headingMatch
            ? headingMatch[1].trim().replace(/\[|\]/g, "")
            : `${title}重點${i + 1}`,
          subheadings: subheadingsMatch
            ? subheadingsMatch[1]
                .split(/[、,，]/)
                .map((s) => s.trim().replace(/\[|\]/g, ""))
                .slice(0, 2)
            : [],
          keyPoints: keyPointsMatch
            ? keyPointsMatch[1]
                .split(/[、,，]/)
                .map((s) => s.trim().replace(/\[|\]/g, ""))
                .slice(0, 3)
            : [],
          targetWordCount: sectionWordCount,
          keywords: keywordsMatch
            ? keywordsMatch[1]
                .split(/[、,，]/)
                .map((s) => s.trim().replace(/\[|\]/g, ""))
                .slice(0, 3)
            : [title],
        };

        console.log(`[StrategyAgent] Parsed section ${i + 1}:`, {
          heading: section.heading,
          keyPointsCount: section.keyPoints.length,
        });

        mainSections.push(section);
      }
    }

    console.log(
      "[StrategyAgent] Final main sections count:",
      mainSections.length,
    );

    if (mainSections.length === 0) {
      console.warn("[StrategyAgent] No main sections parsed, using fallback");
      console.warn(
        "[StrategyAgent] Main match content (first 500):",
        mainMatch?.[0]?.substring(0, 500),
      );
      return this.getFallbackOutline(title, targetWordCount);
    }

    const conclusion = conclusionMatch
      ? {
          summary:
            extractListItems(conclusionMatch[0])[0] || `${title}的核心要點回顧`,
          callToAction:
            extractListItems(conclusionMatch[0])[1] ||
            `開始實踐${title}，提升您的能力`,
          wordCount: 150,
        }
      : {
          summary: `${title}的核心要點回顧`,
          callToAction: `開始實踐${title}，提升您的能力`,
          wordCount: 150,
        };

    const faq: Array<{ question: string; answerOutline: string }> = [];
    if (faqMatch) {
      const faqLines = faqMatch[0].split("\n").filter((line) => line.trim());
      for (let i = 0; i < faqLines.length && faq.length < 2; i++) {
        const match = faqLines[i].match(/[?？](.+)/);
        if (match) {
          faq.push({
            question: faqLines[i].trim(),
            answerOutline: faqLines[i + 1]?.trim() || "詳細說明",
          });
        }
      }
    }

    if (faq.length === 0) {
      faq.push(
        {
          question: `${title}適合新手嗎？`,
          answerOutline: "適合，本文從基礎講起",
        },
        {
          question: `學習${title}需要多久？`,
          answerOutline: "視個人情況，通常 1-3 個月",
        },
      );
    }

    return { introduction, mainSections, conclusion, faq };
  }

  private getFallbackOutline(
    title: string,
    targetWordCount: number,
  ): StrategyOutput["outline"] {
    const sectionCount = 3;
    // 每段上限 150 字
    const sectionWordCount = Math.min(
      Math.floor((targetWordCount - 200) / sectionCount),
      150,
    );

    // 提取核心關鍵詞（避免使用完整標題）
    const extractKeyTopic = (fullTitle: string): string => {
      // 移除數字前綴（如 "10個"）
      let topic = fullTitle.replace(/^\d+個/, "").trim();

      // 處理 "讓...成為" 結構，提取中間的關鍵詞
      const letBecomeMatch = topic.match(/^讓(.+?)成為/);
      if (letBecomeMatch && letBecomeMatch[1]) {
        return letBecomeMatch[1].trim();
      }

      // 移除常見後綴詞
      topic = topic
        .replace(/的?(完整)?指南$/, "")
        .replace(/的?(實用)?技巧$/, "")
        .replace(/的?方法$/, "")
        .replace(/的?教學$/, "")
        .replace(/全攻略$/, "")
        .trim();

      // 如果還是很長（超過 20 字），取前面關鍵部分
      if (topic.length > 20) {
        // 尋找分隔符（的、：、|等）
        const match = topic.match(/^(.{5,20}?)(?:的|：|:|\|)/);
        if (match && match[1]) {
          topic = match[1].trim();
        } else {
          // 沒有明顯分隔符，取前 15 字
          topic = topic.substring(0, 15);
        }
      }

      return topic;
    };

    const keyTopic = extractKeyTopic(title);

    return {
      introduction: {
        hook: `${keyTopic}完整指南`,
        context: `關於${keyTopic}的重要資訊`,
        thesis: `本文將帶你了解${keyTopic}`,
        wordCount: 120,
      },
      mainSections: [
        {
          heading: `認識${keyTopic}`,
          subheadings: [`什麼是${keyTopic}`, `${keyTopic}的重要性`],
          keyPoints: [`${keyTopic}介紹`, `${keyTopic}特點`],
          targetWordCount: sectionWordCount,
          keywords: [keyTopic],
        },
        {
          heading: `${keyTopic}實務應用`,
          subheadings: [`${keyTopic}使用方式`, `${keyTopic}注意事項`],
          keyPoints: [`${keyTopic}操作`, `${keyTopic}建議`],
          targetWordCount: sectionWordCount,
          keywords: [keyTopic],
        },
      ],
      conclusion: {
        summary: `${keyTopic}總結`,
        callToAction: `開始嘗試${keyTopic}`,
        wordCount: 100,
      },
      faq: [
        {
          question: `${keyTopic}適合誰？`,
          answerOutline: `適合想了解${keyTopic}的讀者`,
        },
        {
          question: `如何開始${keyTopic}？`,
          answerOutline: `按照文章步驟即可開始`,
        },
      ],
    };
  }

  private async generateLSIKeywords(input: StrategyInput): Promise<string[]> {
    const fallbackKeywords = input.researchData.relatedKeywords.slice(0, 5);

    if (fallbackKeywords.length >= 5) {
      console.log(
        "[StrategyAgent] Using related keywords as LSI keywords (fallback)",
      );
      return fallbackKeywords;
    }

    try {
      const prompt = `為文章標題 "${input.researchData.title}" 生成 5 個 LSI 關鍵字。

輸出格式（必須是純 JSON 陣列）:
["關鍵字1", "關鍵字2", "關鍵字3", "關鍵字4", "關鍵字5"]`;

      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.1,
        maxTokens: 100,
        format: "json",
      });

      const parsed = JSON.parse(response.content);
      const lsiKeywords = parsed.keywords || parsed;

      if (!Array.isArray(lsiKeywords) || lsiKeywords.length < 5) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error("Invalid LSI keywords format");
      }

      return lsiKeywords;
    } catch (error) {
      console.warn(
        "[StrategyAgent] LSI keywords generation failed, using fallback:",
        error,
      );
      return fallbackKeywords;
    }
  }

  private calculateWordDistribution(
    targetWordCount: number,
    outline: StrategyOutput["outline"],
  ): StrategyOutput["sectionWordDistribution"] {
    const mainSectionsTotal = outline.mainSections.reduce(
      (sum, section) => sum + section.targetWordCount,
      0,
    );

    const introWordCount = outline.introduction?.wordCount || 200;
    const conclusionWordCount = outline.conclusion?.wordCount || 150;
    const faqWordCount = Math.max(
      0,
      targetWordCount -
        introWordCount -
        mainSectionsTotal -
        conclusionWordCount,
    );

    return {
      introduction: introWordCount,
      mainSections: mainSectionsTotal,
      conclusion: conclusionWordCount,
      faq: faqWordCount,
    };
  }

  /**
   * 生成圖片指引（風格和文字建議）
   * 用於 Seedream v4 等支援文字渲染的圖片生成模型
   */
  private async generateImageGuidance(
    input: StrategyInput,
    selectedTitle: string,
    outline: StrategyOutput["outline"],
  ): Promise<ImageGuidance> {
    const targetLang = input.targetLanguage || "zh-TW";

    // 從 brandVoice 提取風格提示
    const brandStyle = input.brandVoice?.tone_of_voice || "";
    const targetAudience = input.brandVoice?.target_audience || "";

    // 圖片文字使用與關鍵字相同的語系（Gemini 3.1 Flash Image 支援多語系文字渲染）
    const langExamples =
      LOCALE_IMAGE_TEXT_EXAMPLES[targetLang] ||
      LOCALE_IMAGE_TEXT_EXAMPLES["en-US"];
    const prompt = `Generate image suggestions for an article titled: "${selectedTitle}"

## Article Outline
${outline.mainSections.map((s, i) => `${i + 1}. ${s.heading}`).join("\n")}

## Brand Info
- Tone: ${brandStyle || "professional, friendly"}
- Target audience: ${targetAudience || "general readers"}
- Target language: ${targetLang}

## Task
Provide image generation suggestions:

1. **style**: Describe the overall visual style (e.g., "professional photography, modern minimalist, warm lighting, clean background")
2. **featuredImageText**: SHORT text for the featured/hero image (2-4 words, like a tagline or key concept)
3. **sectionImageTexts**: SHORT text for each section image (2-4 words each, reinforcing the section's key message)

## Text Language Guidelines (IMPORTANT)
- ALL text MUST be in the SAME language as the article: ${targetLang}
- Keep text SHORT: 2-4 words maximum
- Use impactful keywords or phrases in ${targetLang}
- Examples for ${targetLang}: ${langExamples.join(", ")}
- Text should be suitable for overlay on images

## Output Format (JSON only)
{
  "style": "professional photography, clean and modern, bright natural lighting, minimalist composition",
  "featuredImageText": "${langExamples[0]}",
  "sectionImageTexts": ["${langExamples[1]}", "${langExamples[2]}", "${langExamples[3]}"]
}

Output JSON only:`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.7,
        maxTokens: 500,
        format: "json",
      });

      if (!response.content) {
        console.warn(
          "[StrategyAgent] Empty imageGuidance response, using fallback",
        );
        return this.getFallbackImageGuidance(outline, targetLang);
      }

      const content = response.content.trim();

      // 嘗試解析 JSON
      let parsed: ImageGuidance | null = null;

      // 清理可能的 markdown 包裹
      let cleanContent = content;
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent
          .replace(/^```json\s*\n?/, "")
          .replace(/\n?```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent
          .replace(/^```\s*\n?/, "")
          .replace(/\n?```$/, "");
      }

      try {
        parsed = JSON.parse(cleanContent);
      } catch {
        // 嘗試提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch {
            console.warn(
              "[StrategyAgent] Failed to parse imageGuidance JSON:",
              content.substring(0, 200),
            );
          }
        }
      }

      if (parsed && parsed.style) {
        console.log("[StrategyAgent] ✅ Generated imageGuidance:", {
          style: parsed.style.substring(0, 50),
          featuredText: parsed.featuredImageText,
          sectionTextsCount: parsed.sectionImageTexts?.length || 0,
        });
        return {
          style: parsed.style,
          featuredImageText: parsed.featuredImageText,
          sectionImageTexts: parsed.sectionImageTexts || [],
        };
      }

      console.warn(
        "[StrategyAgent] Invalid imageGuidance format, using fallback",
      );
      return this.getFallbackImageGuidance(outline, targetLang);
    } catch (error) {
      console.error("[StrategyAgent] imageGuidance generation failed:", error);
      return this.getFallbackImageGuidance(outline, targetLang);
    }
  }

  /**
   * 獲取預設的圖片指引（當 AI 生成失敗時使用）
   * 使用目標語系的文字作為 fallback
   */
  private getFallbackImageGuidance(
    outline: StrategyOutput["outline"],
    targetLang: string,
  ): ImageGuidance {
    const langTexts =
      LOCALE_IMAGE_TEXT_EXAMPLES[targetLang] ||
      LOCALE_IMAGE_TEXT_EXAMPLES["en-US"];

    return {
      style:
        "professional photography, clean and modern, bright natural lighting, high quality",
      featuredImageText: langTexts[0],
      sectionImageTexts: outline.mainSections.map((_, index) => {
        return langTexts[index % langTexts.length];
      }),
    };
  }
}
