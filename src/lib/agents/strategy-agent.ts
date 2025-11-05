import { BaseAgent } from './base-agent';
import type { StrategyInput, StrategyOutput } from '@/types/agents';

export class StrategyAgent extends BaseAgent<StrategyInput, StrategyOutput> {
  get agentName(): string {
    return 'StrategyAgent';
  }

  protected async process(input: StrategyInput): Promise<StrategyOutput> {
    const titleOptions = await this.generateTitleOptions(input);

    const outline = await this.generateOutline(input, titleOptions[0]);

    const sectionDistribution = this.calculateWordDistribution(
      input.targetWordCount,
      outline
    );

    return {
      titleOptions,
      selectedTitle: titleOptions[0],
      outline,
      targetWordCount: input.targetWordCount,
      sectionWordDistribution: sectionDistribution,
      keywordDensityTarget: 1.5,
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
        competitiveAdvantages: [
          '深入分析',
          '實用建議',
          '最新資訊',
        ],
      },
      externalReferences: input.researchData.externalReferences,
      executionInfo: this.getExecutionInfo(input.model),
    };
  }

  private async generateTitleOptions(input: StrategyInput): Promise<string[]> {
    const prompt = `你是 SEO 專家。為關鍵字「${input.researchData.keyword}」生成 3 個標題。

## 推理步驟
1. 分析關鍵字意圖和目標受眾
2. 考慮 SEO 最佳實踐（包含關鍵字、適當長度）
3. 評估標題吸引力和點擊率潛力

## 要求
- 包含關鍵字「${input.researchData.keyword}」
- 50-60 字元
- 使用數字或問句提升吸引力

## 輸出格式
請在推理後，輸出以下 JSON 格式：
{
  "reasoning_summary": "簡要說明選擇這些標題的原因",
  "titles": ["標題1", "標題2", "標題3"]
}`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.3,
        maxTokens: Math.min(input.maxTokens || 64000, 1000),
        format: 'json',
      });

      console.log('[StrategyAgent] Raw title response:', {
        contentLength: response.content?.length || 0,
        preview: response.content?.substring(0, 200)
      });

      if (!response.content || response.content.trim() === '') {
        console.warn('[StrategyAgent] Empty response, using fallback titles');
        return this.getFallbackTitles(input.researchData.keyword);
      }

      const content = response.content.trim();

      const arrayMatch = content.match(/\[[\s\S]*?\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(arrayMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            console.log('[StrategyAgent] Successfully parsed titles from array match');
            return parsed.slice(0, 3);
          }
        } catch (e) {
          console.warn('[StrategyAgent] Failed to parse array match:', e);
        }
      }

      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          console.log('[StrategyAgent] Successfully parsed titles from full content');
          return parsed.slice(0, 3);
        }
        if (parsed.titles && Array.isArray(parsed.titles) && parsed.titles.length >= 3) {
          console.log('[StrategyAgent] Successfully parsed titles from .titles property', {
            reasoning: parsed.reasoning_summary?.substring(0, 100),
            titlesCount: parsed.titles.length
          });
          return parsed.titles.slice(0, 3);
        }
      } catch (e) {
        console.warn('[StrategyAgent] Failed to parse full content as JSON:', e);
      }

      console.warn('[StrategyAgent] Invalid title format, using fallback');
      return this.getFallbackTitles(input.researchData.keyword);

    } catch (error) {
      console.error('[StrategyAgent] Title generation failed:', error);
      return this.getFallbackTitles(input.researchData.keyword);
    }
  }

  private getFallbackTitles(keyword: string): string[] {
    return [
      `${keyword}完整指南：從入門到精通`,
      `2025 最新${keyword}教學：實用技巧大公開`,
      `${keyword}全攻略：專家推薦的 10 個關鍵重點`,
    ];
  }

  private async generateOutline(
    input: StrategyInput,
    selectedTitle: string
  ): Promise<StrategyOutput['outline']> {
    const topCompetitors = input.researchData.competitorAnalysis.slice(0, 3);
    const topGaps = input.researchData.contentGaps.slice(0, 3);

    const prompt = `為「${input.researchData.keyword}」生成文章大綱。

## 背景資訊
- 標題：${selectedTitle}
- 目標字數：${input.targetWordCount}

## 競爭對手優勢
${topCompetitors.map(c => `- ${c.strengths.slice(0, 2).join('、')}`).join('\n')}

## 內容缺口（需要補足）
${topGaps.join('\n')}

## 推理步驟
1. 分析目標關鍵字和讀者需求
2. 評估競爭對手的優勢，思考如何超越
3. 識別內容缺口，規劃獨特價值
4. 設計結構化大綱，確保邏輯流暢
5. 分配字數比例，平衡深度與廣度

## 重要規則
1. mainSections 最多 4 個
2. 每個 section 的 keyPoints 最多 3 個，每個最多 20 字
3. faq 最多 2 個
4. 字數分配要合理，總和應接近目標字數

## 輸出格式
請在推理後，輸出以下 JSON 格式：
{
  "reasoning_summary": "簡要說明大綱設計的策略思考",
  "outline": {
    "introduction": {
      "hook": "吸引讀者的開場",
      "context": "背景說明",
      "thesis": "核心論點",
      "wordCount": 200
    },
    "mainSections": [
      {
        "heading": "主要段落標題",
        "subheadings": ["子標題1"],
        "keyPoints": ["重點1"],
        "targetWordCount": 400,
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
        "question": "常見問題",
        "answerOutline": "答案大綱"
      }
    ]
  }
}`;

    let apiResponse;
    try {
      apiResponse = await this.complete(prompt, {
        model: input.model,
        temperature: input.temperature || 0.5,
        maxTokens: Math.floor((input.maxTokens || 64000) * 0.9),
        format: 'json',
      });

      if (!apiResponse.content || apiResponse.content.trim() === '') {
        console.warn('[StrategyAgent] Empty outline response, using fallback');
        return this.getFallbackOutline(input.researchData.keyword, input.targetWordCount);
      }

      let content = apiResponse.content.trim();

      // 嘗試解析新格式（包含 reasoning_summary 和 outline）
      let parsed;
      try {
        const fullMatch = content.match(/\{[\s\S]*"outline"[\s\S]*\}/);
        if (fullMatch) {
          parsed = JSON.parse(fullMatch[0]);
          if (parsed.outline) {
            console.log('[StrategyAgent] Parsed outline with reasoning:', {
              reasoning: parsed.reasoning_summary?.substring(0, 100),
              hasSections: !!parsed.outline.mainSections
            });
            content = JSON.stringify(parsed.outline);
          }
        }
      } catch (e) {
        console.warn('[StrategyAgent] Failed to parse new format, trying legacy:', e);
      }

      // 回退到舊格式
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }

      let jsonStr = content.replace(/,(\s*[}\]])/g, '$1');

      if (!jsonStr.endsWith('}')) {
        const lastBrace = jsonStr.lastIndexOf('}');
        const lastBracket = jsonStr.lastIndexOf(']');
        const lastValid = Math.max(lastBrace, lastBracket);
        if (lastValid > 0) {
          jsonStr = jsonStr.substring(0, lastValid + 1);
        }
      }

      const openBraces = (jsonStr.match(/\{/g) || []).length;
      const closeBraces = (jsonStr.match(/\}/g) || []).length;
      const openBrackets = (jsonStr.match(/\[/g) || []).length;
      const closeBrackets = (jsonStr.match(/\]/g) || []).length;

      if (openBrackets > closeBrackets) {
        jsonStr += ']'.repeat(openBrackets - closeBrackets);
      }
      if (openBraces > closeBraces) {
        jsonStr += '}'.repeat(openBraces - closeBraces);
      }

      const outline = JSON.parse(jsonStr);

      if (!outline.mainSections || outline.mainSections.length === 0) {
        console.warn('[StrategyAgent] Invalid outline structure, using fallback');
        return this.getFallbackOutline(input.researchData.keyword, input.targetWordCount);
      }

      return outline;

    } catch (error) {
      console.error('[StrategyAgent] Outline generation failed:', error);
      console.error('[StrategyAgent] Response (first 500):', apiResponse?.content?.substring(0, 500));
      console.error('[StrategyAgent] Response (last 300):', apiResponse?.content?.substring(Math.max(0, (apiResponse?.content?.length || 0) - 300)));
      return this.getFallbackOutline(input.researchData.keyword, input.targetWordCount);
    }
  }

  private getFallbackOutline(keyword: string, targetWordCount: number): StrategyOutput['outline'] {
    const sectionCount = 3;
    const sectionWordCount = Math.floor((targetWordCount - 350) / sectionCount);

    return {
      introduction: {
        hook: `${keyword}是什麼？為什麼重要？`,
        context: `${keyword}的基本概念與應用場景`,
        thesis: `本文將深入探討${keyword}的各個面向`,
        wordCount: 200,
      },
      mainSections: [
        {
          heading: `${keyword}基礎知識`,
          subheadings: ['核心概念', '重要術語'],
          keyPoints: ['定義與原理', '應用範圍', '基本特點'],
          targetWordCount: sectionWordCount,
          keywords: [keyword, '基礎', '入門'],
        },
        {
          heading: `${keyword}實用技巧`,
          subheadings: ['進階方法', '常見問題'],
          keyPoints: ['實用策略', '避免錯誤', '最佳實踐'],
          targetWordCount: sectionWordCount,
          keywords: [keyword, '技巧', '方法'],
        },
        {
          heading: `${keyword}案例分析`,
          subheadings: ['成功案例', '經驗分享'],
          keyPoints: ['實際應用', '效果評估', '經驗總結'],
          targetWordCount: sectionWordCount,
          keywords: [keyword, '案例', '實戰'],
        },
      ],
      conclusion: {
        summary: `${keyword}的核心要點回顧`,
        callToAction: `開始實踐${keyword}，提升您的能力`,
        wordCount: 150,
      },
      faq: [
        {
          question: `${keyword}適合新手嗎？`,
          answerOutline: '適合，本文從基礎講起',
        },
        {
          question: `學習${keyword}需要多久？`,
          answerOutline: '視個人情況，通常 1-3 個月',
        },
      ],
    };
  }

  private async generateLSIKeywords(input: StrategyInput): Promise<string[]> {
    const fallbackKeywords = input.researchData.relatedKeywords.slice(0, 5);

    if (fallbackKeywords.length >= 5) {
      console.log('[StrategyAgent] Using related keywords as LSI keywords (fallback)');
      return fallbackKeywords;
    }

    try {
      const prompt = `為關鍵字 "${input.researchData.keyword}" 生成 5 個 LSI 關鍵字。

輸出格式（必須是純 JSON 陣列）:
["關鍵字1", "關鍵字2", "關鍵字3", "關鍵字4", "關鍵字5"]`;

      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.1,
        maxTokens: 100,
        format: 'json',
      });

      const parsed = JSON.parse(response.content);
      const lsiKeywords = parsed.keywords || parsed;

      if (!Array.isArray(lsiKeywords) || lsiKeywords.length < 5) {
        const jsonMatch = response.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('Invalid LSI keywords format');
      }

      return lsiKeywords;
    } catch (error) {
      console.warn('[StrategyAgent] LSI keywords generation failed, using fallback:', error);
      return fallbackKeywords;
    }
  }

  private calculateWordDistribution(
    targetWordCount: number,
    outline: StrategyOutput['outline']
  ): StrategyOutput['sectionWordDistribution'] {
    const mainSectionsTotal = outline.mainSections.reduce(
      (sum, section) => sum + section.targetWordCount,
      0
    );

    const introWordCount = outline.introduction?.wordCount || 200;
    const conclusionWordCount = outline.conclusion?.wordCount || 150;
    const faqWordCount = Math.max(0, targetWordCount - introWordCount - mainSectionsTotal - conclusionWordCount);

    return {
      introduction: introWordCount,
      mainSections: mainSectionsTotal,
      conclusion: conclusionWordCount,
      faq: faqWordCount,
    };
  }
}
