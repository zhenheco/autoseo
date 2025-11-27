import { BaseAgent } from "./base-agent";
import type { StrategyInput, StrategyOutput } from "@/types/agents";

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return "StrategyAgent";
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const titleOptions = await this.generateTitleOptions(input);

    const selectedTitle =
      input.title || (await this.selectBestTitle(titleOptions, input));

    const outline = await this.generateOutline(input, selectedTitle);

    const sectionDistribution = this.calculateWordDistribution(
      input.targetWordCount,
      outline,
    );

    return {
      titleOptions,
      selectedTitle,
      outline,
      targetWordCount: input.targetWordCount,
      sectionWordDistribution: sectionDistribution,
      keywordDensityTarget: 2.0,
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
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateTitleOptions(input: StrategyInput): Promise<string[]> {
    const prompt = `你是 SEO 專家。為文章標題「${input.researchData.title}」生成 3 個標題。

## 推理步驟
1. 分析標題意圖和目標受眾
2. 考慮 SEO 最佳實踐（包含關鍵字、適當長度）
3. 評估標題吸引力和點擊率潛力

## 要求
- 包含關鍵字「${input.researchData.title}」
- 50-60 字元
- 使用數字或問句提升吸引力

## 輸出格式
請在推理後，輸出以下 JSON 格式：
{
  "reasoning_summary": "簡要說明選擇這些標題的原因",
  "titles": ["<你生成的第一個標題>", "<你生成的第二個標題>", "<你生成的第三個標題>"]
}

注意：不要使用「標題1」「標題2」等作為實際標題，請生成具體、有意義的文章標題。`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.3,
        maxTokens: Math.min(input.maxTokens || 64000, 1000),
        format: "json",
      });

      console.log("[StrategyAgent] Raw title response:", {
        contentLength: response.content?.length || 0,
        preview: response.content?.substring(0, 200),
      });

      if (!response.content || response.content.trim() === "") {
        console.warn("[StrategyAgent] Empty response, using fallback titles");
        return this.getFallbackTitles(input.researchData.title);
      }

      const content = response.content.trim();

      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            console.log(
              "[StrategyAgent] Successfully parsed titles from array match",
            );
            return parsed.slice(0, 3);
          }
        } catch (e) {
          console.warn("[StrategyAgent] Failed to parse array match:", e);
        }
      }

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          console.log(
            "[StrategyAgent] Successfully parsed titles from full content",
          );
          return parsed.slice(0, 3);
        }
        if (
          parsed.titles &&
          Array.isArray(parsed.titles) &&
          parsed.titles.length >= 3
        ) {
          console.log(
            "[StrategyAgent] Successfully parsed titles from .titles property",
            {
              reasoning: parsed.reasoning_summary?.substring(0, 100),
              titlesCount: parsed.titles.length,
            },
          );
          return parsed.titles.slice(0, 3);
        }
      } catch (e) {
        console.warn(
          "[StrategyAgent] Failed to parse full content as JSON:",
          e,
        );
      }

      console.warn("[StrategyAgent] Invalid title format, using fallback");
      return this.getFallbackTitles(input.researchData.title);
    } catch (error) {
      console.error("[StrategyAgent] Title generation failed:", error);
      return this.getFallbackTitles(input.researchData.title);
    }
  }

  private getFallbackTitles(title: string): string[] {
    return [
      `${title}完整指南：從入門到精通`,
      `2025 最新${title}教學：實用技巧大公開`,
      `${title}全攻略：專家推薦的 10 個關鍵重點`,
    ];
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

  private scoreTitleSEO(title: string, input: StrategyInput): number {
    let score = 0;
    const keyword = input.researchData.title.toLowerCase();

    if (
      title
        .toLowerCase()
        .includes(keyword.substring(0, Math.min(keyword.length, 10)))
    ) {
      score += 30;
    }

    if (/\d+/.test(title)) {
      score += 20;
    }

    const length = title.length;
    if (length >= 30 && length <= 60) {
      score += 25;
    } else if (length >= 20 && length <= 70) {
      score += 15;
    }

    const powerWords = [
      "完整",
      "最新",
      "專業",
      "實用",
      "必學",
      "精選",
      "攻略",
      "秘訣",
      "技巧",
      "指南",
    ];
    for (const word of powerWords) {
      if (title.includes(word)) {
        score += 5;
      }
    }

    if (title.includes("？") || title.includes("?")) {
      score += 10;
    }

    return score;
  }

  private async generateOutline(
    input: StrategyInput,
    selectedTitle: string,
  ): Promise<StrategyOutput["outline"]> {
    // 使用結構化 JSON schema + DeepSeek JSON mode
    try {
      const outlineSchema = this.getOutlineSchema();

      // Language mapping
      const languageNames: Record<string, string> = {
        "zh-TW": "Traditional Chinese (繁體中文)",
        "zh-CN": "Simplified Chinese (简体中文)",
        en: "English",
        ja: "Japanese (日本語)",
        ko: "Korean (한국어)",
        es: "Spanish (Español)",
        fr: "French (Français)",
        de: "German (Deutsch)",
        pt: "Portuguese (Português)",
        it: "Italian (Italiano)",
        ru: "Russian (Русский)",
        ar: "Arabic (العربية)",
        th: "Thai (ไทย)",
        vi: "Vietnamese (Tiếng Việt)",
        id: "Indonesian (Bahasa Indonesia)",
      };

      const targetLang = input.targetLanguage || "zh-TW";
      const languageName = languageNames[targetLang] || languageNames["zh-TW"];

      const prompt = `Generate a structured outline for the article titled "${selectedTitle}".

Target language: ${languageName}
Target word count: ${input.targetWordCount}
Search intent: ${input.researchData.searchIntent}
Content gaps: ${input.researchData.contentGaps.slice(0, 3).join(", ")}

**Strictly follow this JSON Schema for output**:

${JSON.stringify(outlineSchema, null, 2)}

**Rules**:
1. All text content (headings, hook, context, thesis, etc.) MUST be written in ${languageName}
2. mainSections must have 2-4 items
3. Each section's heading must be unique
4. Total targetWordCount should be close to ${input.targetWordCount}
5. Output JSON object directly (don't wrap with \`\`\`)
6. **FORBIDDEN sections/subheadings** (DO NOT include any of these):
   - ❌ 常見問題解決 / 常見問題 / 問題解決 / FAQ
   - ❌ 實戰案例分析 / 案例分析 / 成功案例
   - ❌ 進階應用與最佳實踐
   - ❌ Any section that looks like troubleshooting or FAQ
   (FAQ will be generated separately by another agent)

Please output the complete JSON that conforms to the above schema in ${languageName}:`;

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
      const parsed = this.validateAndParseOutline(
        response.content,
        outlineSchema,
      );

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
            wordCount: { type: "number", description: "字數（約 200）" },
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
              targetWordCount: { type: "number", description: "目標字數" },
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
            wordCount: { type: "number", description: "字數（約 150）" },
          },
        },
        faq: {
          type: "array",
          minItems: 2,
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
    schema: any,
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

      // 驗證每個 section 的必要欄位
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
      }

      // 驗證 FAQ
      if (!Array.isArray(parsed.faq) || parsed.faq.length < 2) {
        console.warn("[StrategyAgent] Invalid faq array");
        return null;
      }

      console.log("[StrategyAgent] ✅ Outline validation passed");
      return parsed as StrategyOutput["outline"];
    } catch (error) {
      console.warn("[StrategyAgent] JSON parsing/validation failed:", error);
      return null;
    }
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
    "hook": "開場吸引讀者的方式",
    "context": "背景說明",
    "thesis": "主要觀點",
    "wordCount": 200
  },
  "mainSections": [
    {
      "heading": "<第一個章節的具體標題>",
      "subheadings": ["<第一個子標題>", "<第二個子標題>"],
      "keyPoints": ["<第一個重點>", "<第二個重點>"],
      "targetWordCount": 500,
      "keywords": ["<相關關鍵字1>", "<相關關鍵字2>"]
    },
    {
      "heading": "<第二個章節的具體標題>",
      "subheadings": ["<第一個子標題>", "<第二個子標題>"],
      "keyPoints": ["<第一個重點>", "<第二個重點>"],
      "targetWordCount": 500,
      "keywords": ["<相關關鍵字>"]
    }
  ],
  "conclusion": {
    "summary": "總結重點",
    "callToAction": "行動呼籲",
    "wordCount": 150
  },
  "faq": [
    {
      "question": "<與主題相關的常見問題>？",
      "answerOutline": "<答案大綱>"
    }
  ]
}

注意：請勿使用「標題1」「子標題1」「常見問題1」等占位符作為實際內容，請生成具體、有意義的標題和內容。

**規則：**
1. mainSections 2-4 個
2. 每個 section 標題要獨特，避免重複
3. 直接輸出 JSON，不要用 \`\`\`json 包裹
4. 確保 JSON 格式正確

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
    const sectionWordCount = Math.floor((targetWordCount - 350) / sectionCount);

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
        hook: `為什麼${keyTopic}如此重要？`,
        context: `${keyTopic}的背景與應用場景`,
        thesis: `本文將深入探討${keyTopic}的核心概念與實踐方法`,
        wordCount: 200,
      },
      mainSections: [
        {
          heading: "基礎概念與環境設定",
          subheadings: ["核心概念解析", "環境準備與配置"],
          keyPoints: ["基本定義與原理", "必要工具與資源", "初始設定步驟"],
          targetWordCount: sectionWordCount,
          keywords: [keyTopic, "基礎", "入門", "設定"],
        },
        {
          heading: "核心功能與實用技巧",
          subheadings: ["主要功能介紹", "進階使用技巧"],
          keyPoints: ["關鍵功能說明", "實用操作方法", "效率提升技巧"],
          targetWordCount: sectionWordCount,
          keywords: [keyTopic, "功能", "技巧", "方法"],
        },
      ],
      conclusion: {
        summary: `${keyTopic}核心要點總結`,
        callToAction: `立即開始實踐，掌握${keyTopic}的精髓`,
        wordCount: 150,
      },
      faq: [
        {
          question: `${keyTopic}適合初學者嗎？`,
          answerOutline: "適合，本文從基礎概念開始循序漸進",
        },
        {
          question: `需要哪些前置知識？`,
          answerOutline: "基本的相關背景即可，文中會詳細說明",
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
}
