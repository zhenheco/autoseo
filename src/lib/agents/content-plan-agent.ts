import { BaseAgent } from "./base-agent";
import type {
  ContentPlanInput,
  ContentPlanOutput,
  SectionPlan,
  SpecialBlock,
} from "@/types/agents";

export class ContentPlanAgent extends BaseAgent<
  ContentPlanInput,
  ContentPlanOutput
> {
  get agentName(): string {
    return "ContentPlanAgent";
  }

  protected async process(input: ContentPlanInput): Promise<ContentPlanOutput> {
    const startTime = Date.now();

    const prompt = this.buildPrompt(input);

    const response = await this.complete(prompt, {
      model: input.model,
      temperature: input.temperature || 0.4,
      maxTokens: input.maxTokens || 8000,
      format: "json",
    });

    const contentPlan = this.parseResponse(response.content, input);

    contentPlan.executionInfo = {
      model: input.model,
      totalTokens:
        response.usage.promptTokens + response.usage.completionTokens,
      latencyMs: Date.now() - startTime,
    };

    return contentPlan;
  }

  private buildPrompt(input: ContentPlanInput): string {
    const { strategy, research, competitorAnalysis, brandVoice } = input;
    const targetLang = input.targetLanguage || "zh-TW";

    const deepResearchSection = this.buildDeepResearchSection(research);
    const specialBlockGuidance = this.determineSpecialBlockType(
      strategy.selectedTitle,
      research,
    );

    return `你是一位專業的內容策略專家。請根據以下資訊，為文章生成詳細的寫作計劃。

## 文章標題
${strategy.selectedTitle}

## 目標關鍵字
${research.title}

## 品牌資訊
- 品牌名稱：${brandVoice?.brand_name || "無"}
- 語調風格：${brandVoice?.tone_of_voice || "專業、友善"}
- 目標讀者：${brandVoice?.target_audience || "一般大眾"}

## 搜尋意圖
${research.searchIntent}（信心度：${research.intentConfidence}）

## 競爭對手分析摘要
${
  competitorAnalysis?.differentiationStrategy
    ? `
- 內容角度：${competitorAnalysis.differentiationStrategy.contentAngle}
- 價值增強：${competitorAnalysis.differentiationStrategy.valueEnhancement}
- 缺失角度：${competitorAnalysis.competitorAnalysis?.missingAngles?.join(", ") || "無"}
`
    : "無競爭對手分析資料"
}

## 內容缺口
${research.contentGaps.slice(0, 5).join("\n- ")}

${deepResearchSection}

## 現有大綱結構
${JSON.stringify(strategy.outline, null, 2)}

## 特殊區塊建議
${specialBlockGuidance}

## 輸出要求
請生成完整的 ContentPlanOutput JSON，包含：

1. **optimizedTitle**: 優化後的標題（primary, alternatives, reasoning）
2. **contentStrategy**: 內容策略（primaryAngle, userPainPoints, valueProposition, differentiationPoints, toneGuidance）
3. **detailedOutline**: 詳細大綱
   - introduction: 引言計劃
   - mainSections: 2-4 個主要區塊，每個包含 h2Title, subheadings, writingInstructions, researchInsights, targetWordCount, keyPoints, 以及選擇性的 specialBlock
   - faq: FAQ 計劃（h2Title, questions 陣列，每個問題包含 question 和 answerGuidelines）
   - conclusion: 結論計劃
4. **seoOptimization**: SEO 優化建議
5. **localization**: 地區本地化建議
6. **researchInsights**: 從深度研究中提取的洞察

## 語言
所有內容必須使用 ${targetLang === "zh-TW" ? "繁體中文" : targetLang === "zh-CN" ? "简体中文" : "English"}

## H2 結構指導原則（重要！）
現有大綱僅供參考，你可以根據以下原則調整：

1. **避免公式化結構**：不要使用固定模板如「基礎概念」→「進階應用」→「常見問題」
2. **根據內容特性決定結構**：
   - 教學類：可用步驟流程（第一步→第二步→...）
   - 比較類：可用對比結構（A vs B、優缺點分析）
   - 問題解決類：可用痛點→解決方案結構
   - 概念介紹類：可用 What→Why→How 結構
3. **H2 標題要具體**：避免泛泛的「基礎概念」「進階應用」，改用具體描述如「5 分鐘學會核心操作」「3 個常見錯誤及解決方法」
4. **彈性調整**：mainSections 可以是 2-4 個，根據內容深度決定
5. **subheadings 要有邏輯**：子標題之間要有明確的邏輯關係，不是隨意堆砌

## 禁止使用的公式化 H2
- ❌「基礎概念與準備工作」
- ❌「進階應用與最佳實踐」
- ❌「常見問題解決」（FAQ 已單獨處理）
- ❌「總結與展望」

## 重要規則
1. mainSections 數量：2-4 個（根據內容需求彈性調整）
2. 每個 section 的 writingInstructions 要具體、可執行
3. specialBlock 根據文章主題選擇性使用（參考上方特殊區塊建議）
4. FAQ 問題數量為 6-8 個
5. 所有內容必須與標題主題直接相關
6. H2 標題必須原創，不要照抄現有大綱
7. **FAQ 區塊必須存在**：文章結構最後一定要有獨立的 FAQ H2 區塊（在 conclusion 之前）

請直接輸出 JSON，不要用 \`\`\`json 包裹：`;
  }

  private buildDeepResearchSection(
    research: ContentPlanInput["research"],
  ): string {
    if (!research.deepResearch) {
      return "## 深度研究資料\n無深度研究資料";
    }

    const sections: string[] = ["## 深度研究資料"];

    if (research.deepResearch.trends?.content) {
      sections.push("\n### 最新趨勢");
      sections.push(research.deepResearch.trends.content.substring(0, 500));
      if (research.deepResearch.trends.citations?.length > 0) {
        sections.push(
          `\n來源：${research.deepResearch.trends.citations.slice(0, 3).join(", ")}`,
        );
      }
    }

    if (research.deepResearch.userQuestions?.content) {
      sections.push("\n### 用戶常見問題");
      sections.push(
        research.deepResearch.userQuestions.content.substring(0, 500),
      );
    }

    if (research.deepResearch.authorityData?.content) {
      sections.push("\n### 權威數據");
      sections.push(
        research.deepResearch.authorityData.content.substring(0, 500),
      );
    }

    return sections.join("\n");
  }

  private determineSpecialBlockType(
    title: string,
    research: ContentPlanInput["research"],
  ): string {
    const titleLower = title.toLowerCase();
    const gaps = research.contentGaps.join(" ").toLowerCase();

    const isTutorial =
      /教學|教程|如何|方法|步驟|技巧|攻略/i.test(title) ||
      research.searchIntent === "informational";

    const isLocalService =
      /地區|本地|當地|服務|推薦|哪裡/i.test(title) ||
      (research.region && research.region !== "Global");

    const isSafetyRelated = /安全|風險|警告|注意|避免|問題|錯誤/i.test(title);

    const suggestions: string[] = [];

    if (isTutorial) {
      suggestions.push(`- 建議使用 **tip_block** (小提醒)：提供實用的建議
  - 內容長度：50-80 字
  - 位置：放在操作步驟或技巧說明的區塊中`);
    }

    if (isLocalService) {
      suggestions.push(`- 建議使用 **local_advantage** (本地優勢)：突出地區特色
  - 內容長度：80-120 字
  - 位置：放在服務介紹或優勢說明的區塊中`);
    }

    if (isSafetyRelated) {
      suggestions.push(`- 建議使用 **warning_block** (注意事項)：提醒重要注意事項
  - 內容長度：50-80 字
  - 位置：放在風險說明或注意事項的區塊中`);
    }

    if (suggestions.length === 0) {
      return "根據文章主題，特殊區塊為選擇性使用。";
    }

    return suggestions.join("\n\n");
  }

  private parseResponse(
    content: string,
    input: ContentPlanInput,
  ): ContentPlanOutput {
    try {
      let cleanContent = content.trim();

      // Step 1: 移除 markdown 包裹
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent
          .replace(/^```json\s*\n?/, "")
          .replace(/\n?```$/, "");
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent
          .replace(/^```\s*\n?/, "")
          .replace(/\n?```$/, "");
      }

      // Step 2: 嘗試直接解析（最理想情況）
      try {
        const parsed = JSON.parse(cleanContent);
        if (this.validateContentPlan(parsed)) {
          console.log("[ContentPlanAgent] ✅ Direct JSON parse succeeded");
          return parsed;
        }
      } catch {
        // 繼續嘗試其他方法
      }

      // Step 3: 使用正則提取最外層 JSON 物件（處理思考過程前綴，如 DeepSeek Reasoner 的「首先，用户要求...」）
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (this.validateContentPlan(parsed)) {
            console.log(
              "[ContentPlanAgent] ✅ Regex JSON extraction succeeded",
            );
            return parsed;
          }
        } catch (e) {
          console.warn(
            "[ContentPlanAgent] ⚠️ Regex extraction found JSON but parse failed:",
            e,
          );
        }
      }

      // Step 4: Fallback - 記錄原始內容以便除錯
      console.warn("[ContentPlanAgent] ❌ All parsing attempts failed");
      console.debug(
        "[ContentPlanAgent] Original content (first 500 chars):",
        cleanContent.substring(0, 500),
      );
      return this.buildFallbackContentPlan(input);
    } catch (error) {
      console.error("[ContentPlanAgent] Unexpected error:", error);
      return this.buildFallbackContentPlan(input);
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

  private buildFallbackContentPlan(input: ContentPlanInput): ContentPlanOutput {
    const { strategy, research, brandVoice } = input;

    const mainSections: SectionPlan[] = strategy.outline.mainSections
      .slice(0, 3)
      .map((section, index) => ({
        h2Title: section.heading,
        subheadings: section.subheadings || [],
        writingInstructions: `詳細說明${section.heading}的核心內容，確保與主題「${research.title}」直接相關`,
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

    while (mainSections.length < 3) {
      mainSections.push({
        h2Title: `${research.title}進階說明 ${mainSections.length + 1}`,
        subheadings: ["重點一", "重點二"],
        writingInstructions: "補充說明相關內容",
        researchInsights: [],
        targetWordCount: 400,
        keyPoints: ["關鍵要點"],
      });
    }

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
