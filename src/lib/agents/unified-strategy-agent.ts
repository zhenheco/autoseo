import { BaseAgent } from "./base-agent";
import type {
  StrategyOutput,
  ContentPlanOutput,
  SectionPlan,
  UnifiedStrategyInput,
  UnifiedStrategyOutput,
} from "@/types/agents";

export type { UnifiedStrategyInput, UnifiedStrategyOutput };

export class UnifiedStrategyAgent extends BaseAgent<
  UnifiedStrategyInput,
  UnifiedStrategyOutput
> {
  get agentName(): string {
    return "UnifiedStrategyAgent";
  }

  protected async process(
    input: UnifiedStrategyInput,
  ): Promise<UnifiedStrategyOutput> {
    console.log("[UnifiedStrategyAgent] 開始順序執行：標題 → 大綱 → 內容計劃");

    const titleOptions = await this.generateTitleOptions(input);
    const selectedTitle = await this.selectBestTitle(titleOptions, input);
    console.log("[UnifiedStrategyAgent] 標題生成完成:", selectedTitle);

    const outline = await this.generateOutline(input, selectedTitle);
    console.log(
      "[UnifiedStrategyAgent] 大綱生成完成:",
      outline.mainSections.length,
      "個主要段落",
    );

    const strategy = this.buildStrategyOutput(
      input,
      titleOptions,
      selectedTitle,
      outline,
    );

    const contentPlan = await this.generateContentPlan(
      input,
      strategy,
      selectedTitle,
    );
    console.log("[UnifiedStrategyAgent] 內容計劃生成完成");

    return { strategy, contentPlan };
  }

  private buildStrategyOutput(
    input: UnifiedStrategyInput,
    titleOptions: string[],
    selectedTitle: string,
    outline: StrategyOutput["outline"],
  ): StrategyOutput {
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
      keywords: input.research.relatedKeywords || [],
      relatedKeywords: input.research.relatedKeywords,
      lsiKeywords: input.research.relatedKeywords.slice(0, 5),
      internalLinkingStrategy: {
        targetSections: outline.mainSections.map((s) => s.heading),
        suggestedTopics: input.research.contentGaps.slice(0, 3),
        minLinks: 3,
      },
      differentiationStrategy: {
        uniqueAngles: input.research.contentGaps,
        valueProposition: input.research.recommendedStrategy,
        competitiveAdvantages: ["深入分析", "實用建議", "最新資訊"],
      },
      externalReferences: input.research.externalReferences,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateTitleOptions(
    input: UnifiedStrategyInput,
  ): Promise<string[]> {
    const recommendedStrategy = input.research.recommendedStrategy || "";
    const contentGaps = input.research.contentGaps || [];
    const searchIntent = input.research.searchIntent || "informational";

    const targetLang = input.targetLanguage || "zh-TW";
    const titleLengthRange = this.getTitleLengthRange(targetLang);

    const prompt = `你是一位精通國際市場的 SEO 專家。根據研究分析結果，為主題「${input.research.title}」生成 3 個原創標題。

## 主題關鍵字（僅作為主題參考，不要直接複製）
${input.research.title}

## 研究分析結果
### 建議策略
${recommendedStrategy || "提供專業、實用的內容"}

### 內容缺口（可填補的機會）
${
  contentGaps.length > 0
    ? contentGaps
        .slice(0, 3)
        .map((g, i) => `${i + 1}. ${g}`)
        .join("\n")
    : "無特定缺口"
}

### 搜尋意圖
${searchIntent}

## 標題生成原則
1. **原創性**：標題必須是全新創作，不要直接使用關鍵字作為標題
2. **差異化**：利用內容缺口創造獨特角度
3. **吸引力**：根據搜尋意圖設計能引起共鳴的標題
4. **SEO 友善**：自然融入核心概念，但不要生硬堆砌

## 標題長度要求
- ${titleLengthRange.min}-${titleLengthRange.max} ${targetLang.startsWith("zh") ? "字" : "characters"}

## 禁止使用
- **直接複製關鍵字**：標題 ≠ 關鍵字，必須重新創作
- **泛用模板詞**：「完整指南」「全攻略」「入門到精通」「一次搞懂」「懶人包」「超詳細」
- **年份**：2024、2025 等
- **過度誇大**：「史上最全」「終極」「無敵」

## 輸出格式（只輸出 JSON，不要其他文字）
{
  "titles": ["完整的第一個標題", "完整的第二個標題", "完整的第三個標題"]
}`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.6,
        maxTokens: 1000,
        format: "json",
      });

      if (!response.content || response.content.trim() === "") {
        return this.getFallbackTitles(input.research.title);
      }

      const content = response.content.trim();

      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            return this.filterValidTitles(
              parsed.slice(0, 3),
              input.research.title,
            );
          }
        } catch {
          // Continue to next parsing method
        }
      }

      try {
        const parsed = JSON.parse(content);
        if (
          parsed.titles &&
          Array.isArray(parsed.titles) &&
          parsed.titles.length >= 3
        ) {
          return this.filterValidTitles(
            parsed.titles.slice(0, 3),
            input.research.title,
          );
        }
      } catch {
        // Fall through to fallback
      }

      return this.getFallbackTitles(input.research.title);
    } catch (error) {
      console.error("[UnifiedStrategyAgent] Title generation failed:", error);
      return this.getFallbackTitles(input.research.title);
    }
  }

  private getFallbackTitles(title: string): string[] {
    return [
      `${title}完整解析：從入門到應用`,
      `${title}實戰經驗分享：真實案例與技巧`,
      `深入了解${title}：專業觀點與實用建議`,
    ];
  }

  private filterValidTitles(titles: string[], fallbackTitle: string): string[] {
    const validTitles = titles.filter((t) => {
      if (!t || typeof t !== "string" || t.trim().length < 5) return false;
      if (this.containsPlaceholder(t)) return false;
      return true;
    });

    if (validTitles.length < 3) {
      return this.getFallbackTitles(fallbackTitle);
    }

    return validTitles;
  }

  private containsPlaceholder(text: string): boolean {
    const placeholderPatterns = [
      /<[^>]*標題[^>]*>/,
      /\[[^\]]*標題[^\]]*\]/,
      /\{[^}]*標題[^}]*\}/,
      /placeholder/i,
    ];
    return placeholderPatterns.some((pattern) => pattern.test(text));
  }

  private async selectBestTitle(
    titleOptions: string[],
    input: UnifiedStrategyInput,
  ): Promise<string> {
    if (titleOptions.length === 0) {
      return input.research.title;
    }

    if (titleOptions.length === 1) {
      return titleOptions[0];
    }

    const scores = titleOptions.map((title) =>
      this.scoreTitleSEO(title, input),
    );
    const bestIndex = scores.indexOf(Math.max(...scores));

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

  private scoreTitleSEO(title: string, input: UnifiedStrategyInput): number {
    let score = 0;
    const keyword = input.research.title.toLowerCase();

    if (
      title
        .toLowerCase()
        .includes(keyword.substring(0, Math.min(keyword.length, 10)))
    ) {
      score += 35;
    }

    const targetLang = input.targetLanguage || "zh-TW";
    const { min, max } = this.getTitleLengthRange(targetLang);
    const length = title.length;

    if (length >= min && length <= max) {
      score += 25;
    } else if (length >= min - 5 && length <= max + 10) {
      score += 15;
    }

    const powerWords = ["最新", "專業", "實用", "必學", "精選", "秘訣", "技巧"];
    for (const word of powerWords) {
      if (title.includes(word)) {
        score += 20;
        break;
      }
    }

    if (/\d+/.test(title)) {
      score += 20;
    }

    return Math.min(score, 100);
  }

  private async generateOutline(
    input: UnifiedStrategyInput,
    selectedTitle: string,
  ): Promise<StrategyOutput["outline"]> {
    const targetLang = input.targetLanguage || "zh-TW";
    const languageName = targetLang.startsWith("zh") ? "繁體中文" : "English";

    const prompt = `Generate a structured outline for the article titled "${selectedTitle}".

Target language: ${languageName}
Target word count: ${input.targetWordCount}
Search intent: ${input.research.searchIntent}
Content gaps: ${input.research.contentGaps.slice(0, 3).join(", ")}

Output a valid JSON object with this structure:
{
  "introduction": {
    "hook": "引人入勝的開場",
    "context": "背景說明",
    "thesis": "主要觀點",
    "wordCount": 200
  },
  "mainSections": [
    {
      "heading": "具體的 H2 標題",
      "subheadings": ["子標題1", "子標題2"],
      "keyPoints": ["關鍵重點1", "關鍵重點2"],
      "targetWordCount": 500,
      "keywords": ["相關關鍵字"]
    }
  ],
  "conclusion": {
    "summary": "總結重點",
    "callToAction": "行動呼籲",
    "wordCount": 150
  },
  "faq": [
    {
      "question": "常見問題?",
      "answerOutline": "答案大綱"
    }
  ]
}

Rules:
1. mainSections: 2-4 items
2. All text in ${languageName}
3. No placeholders like <...> or [...]
4. Output JSON directly, no markdown code blocks`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.1,
        maxTokens: 2000,
        format: "json",
      });

      const parsed = this.parseOutlineResponse(response.content);
      if (parsed) {
        return parsed;
      }

      return this.getFallbackOutline(selectedTitle, input.targetWordCount);
    } catch (error) {
      console.warn("[UnifiedStrategyAgent] Outline generation failed:", error);
      return this.getFallbackOutline(selectedTitle, input.targetWordCount);
    }
  }

  private parseOutlineResponse(
    content: string,
  ): StrategyOutput["outline"] | null {
    try {
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

      if (
        !parsed.introduction ||
        !parsed.mainSections ||
        !parsed.conclusion ||
        !parsed.faq
      ) {
        return null;
      }

      if (
        !Array.isArray(parsed.mainSections) ||
        parsed.mainSections.length < 2 ||
        parsed.mainSections.length > 4
      ) {
        return null;
      }

      return parsed as StrategyOutput["outline"];
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.mainSections) {
            return parsed as StrategyOutput["outline"];
          }
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private getFallbackOutline(
    title: string,
    targetWordCount: number,
  ): StrategyOutput["outline"] {
    const sectionCount = 3;
    const sectionWordCount = Math.floor((targetWordCount - 350) / sectionCount);

    const extractKeyTopic = (fullTitle: string): string => {
      let topic = fullTitle.replace(/^\d+個/, "").trim();
      const letBecomeMatch = topic.match(/^讓(.+?)成為/);
      if (letBecomeMatch && letBecomeMatch[1]) {
        return letBecomeMatch[1].trim();
      }
      topic = topic
        .replace(/的?(完整)?指南$/, "")
        .replace(/的?(實用)?技巧$/, "")
        .replace(/的?方法$/, "")
        .replace(/的?教學$/, "")
        .replace(/全攻略$/, "")
        .trim();

      if (topic.length > 20) {
        const match = topic.match(/^(.{5,20}?)(?:的|：|:|\|)/);
        if (match && match[1]) {
          topic = match[1].trim();
        } else {
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
        wordCount: 200,
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
        wordCount: 150,
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

  private async generateContentPlan(
    input: UnifiedStrategyInput,
    strategy: StrategyOutput,
    selectedTitle: string,
  ): Promise<ContentPlanOutput> {
    const targetLang = input.targetLanguage || "zh-TW";

    const prompt = `你是一位專業的內容策略專家。請根據以下資訊，為文章生成詳細的寫作計劃。

## 文章標題
${selectedTitle}

## 目標關鍵字
${input.research.title}

## 品牌資訊
- 品牌名稱：${input.brandVoice?.brand_name || "無"}
- 語調風格：${input.brandVoice?.tone_of_voice || "專業、友善"}
- 目標讀者：${input.brandVoice?.target_audience || "一般大眾"}

## 搜尋意圖
${input.research.searchIntent}

## 內容缺口
${input.research.contentGaps.slice(0, 5).join("\n- ")}

## 現有大綱結構
${JSON.stringify(strategy.outline, null, 2)}

## 輸出要求
請生成完整的 ContentPlanOutput JSON，包含：
1. optimizedTitle: 優化後的標題
2. contentStrategy: 內容策略
3. detailedOutline: 詳細大綱（introduction, mainSections, faq, conclusion）
4. seoOptimization: SEO 優化建議
5. localization: 地區本地化建議
6. researchInsights: 研究洞察

## 語言
所有內容必須使用 ${targetLang === "zh-TW" ? "繁體中文" : targetLang === "zh-CN" ? "简体中文" : "English"}

請直接輸出 JSON，不要用 \`\`\`json 包裹：`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.4,
        maxTokens: 8000,
        format: "json",
      });

      const contentPlan = this.parseContentPlanResponse(
        response.content,
        input,
        strategy,
      );
      return contentPlan;
    } catch (error) {
      console.warn(
        "[UnifiedStrategyAgent] Content plan generation failed:",
        error,
      );
      return this.buildFallbackContentPlan(input, strategy);
    }
  }

  private parseContentPlanResponse(
    content: string,
    input: UnifiedStrategyInput,
    strategy: StrategyOutput,
  ): ContentPlanOutput {
    try {
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

      try {
        const parsed = JSON.parse(cleanContent);
        if (this.validateContentPlan(parsed)) {
          return parsed;
        }
      } catch {
        // Continue to regex extraction
      }

      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (this.validateContentPlan(parsed)) {
            return parsed;
          }
        } catch {
          // Fall through to fallback
        }
      }

      return this.buildFallbackContentPlan(input, strategy);
    } catch {
      return this.buildFallbackContentPlan(input, strategy);
    }
  }

  private validateContentPlan(plan: unknown): plan is ContentPlanOutput {
    if (!plan || typeof plan !== "object") return false;

    const p = plan as Record<string, unknown>;

    if (!p.optimizedTitle || !p.contentStrategy || !p.detailedOutline) {
      return false;
    }

    const outline = p.detailedOutline as Record<string, unknown>;
    if (
      !outline.introduction ||
      !outline.mainSections ||
      !outline.faq ||
      !outline.conclusion
    ) {
      return false;
    }

    const mainSections = outline.mainSections;
    if (
      !Array.isArray(mainSections) ||
      mainSections.length < 2 ||
      mainSections.length > 4
    ) {
      return false;
    }

    return true;
  }

  private buildFallbackContentPlan(
    input: UnifiedStrategyInput,
    strategy: StrategyOutput,
  ): ContentPlanOutput {
    const { research, brandVoice } = input;

    const mainSections: SectionPlan[] = strategy.outline.mainSections
      .slice(0, 3)
      .map((section, index) => ({
        h2Title: section.heading,
        subheadings: section.subheadings || [],
        writingInstructions: `詳細說明${section.heading}的核心內容`,
        researchInsights: section.keyPoints || [],
        targetWordCount: section.targetWordCount || 400,
        keyPoints: section.keyPoints || [],
        specialBlock:
          index === 0
            ? {
                type: "expert_tip" as const,
                content: `關於${research.title}的專業建議`,
              }
            : undefined,
      }));

    return {
      optimizedTitle: {
        primary: strategy.selectedTitle,
        alternatives: strategy.titleOptions.filter(
          (t) => t !== strategy.selectedTitle,
        ),
        reasoning: "基於現有策略選擇的最佳標題",
      },
      contentStrategy: {
        primaryAngle: strategy.differentiationStrategy?.valueProposition || "",
        userPainPoints: research.contentGaps.slice(0, 3),
        valueProposition:
          strategy.differentiationStrategy?.valueProposition || "",
        differentiationPoints:
          strategy.differentiationStrategy?.uniqueAngles || [],
        toneGuidance: brandVoice?.tone_of_voice || "專業、友善、易懂",
      },
      detailedOutline: {
        introduction: {
          hook: strategy.outline.introduction.hook,
          context: strategy.outline.introduction.context,
          thesis: strategy.outline.introduction.thesis,
          targetWordCount: strategy.outline.introduction.wordCount || 200,
        },
        mainSections,
        faq: {
          h2Title: "常見問題",
          questions: strategy.outline.faq.map((faq) => ({
            question: faq.question,
            answerGuidelines: faq.answerOutline,
          })),
          targetWordCount: 600,
        },
        conclusion: {
          summary: strategy.outline.conclusion.summary,
          callToAction: strategy.outline.conclusion.callToAction,
          targetWordCount: strategy.outline.conclusion.wordCount || 150,
        },
      },
      seoOptimization: {
        primaryKeyword: research.title,
        secondaryKeywords: research.relatedKeywords.slice(0, 5),
        lsiKeywords: strategy.lsiKeywords || [],
        keywordPlacement: {
          title: true,
          h2Headings: true,
          firstParagraph: true,
          conclusion: true,
        },
      },
      localization: {
        region: research.region || "Taiwan",
        culturalNotes: [],
        localExamples: [],
      },
      researchInsights: {
        trendTopics: research.deepResearch?.trends?.content
          ? [research.deepResearch.trends.content.substring(0, 100)]
          : [],
        userConcerns: research.deepResearch?.userQuestions?.content
          ? [research.deepResearch.userQuestions.content.substring(0, 100)]
          : [],
        authorityPoints: research.deepResearch?.authorityData?.content
          ? [research.deepResearch.authorityData.content.substring(0, 100)]
          : [],
      },
      executionInfo: {
        model: input.model,
        totalTokens: 0,
        latencyMs: 0,
      },
    };
  }
}
