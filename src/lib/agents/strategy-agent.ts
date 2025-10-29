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

要求：
- 包含關鍵字「${input.researchData.keyword}」
- 50-60 字元
- 使用數字或問句

**只輸出 JSON 陣列，不要任何解釋：**
["標題1", "標題2", "標題3"]`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.3,
        maxTokens: 300,
        format: 'json',
      });

      if (!response.content || response.content.trim() === '') {
        console.warn('[StrategyAgent] Empty response, using fallback titles');
        return this.getFallbackTitles(input.researchData.keyword);
      }

      const jsonMatch = response.content.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed.slice(0, 3);
        }
      }

      const parsed = JSON.parse(response.content.trim());
      if (Array.isArray(parsed) && parsed.length >= 3) {
        return parsed.slice(0, 3);
      }

      console.warn('[StrategyAgent] Invalid title format, using fallback');
      return this.getFallbackTitles(input.researchData.keyword);

    } catch (error) {
      console.error('[StrategyAgent] Title generation failed:', error);
      console.error('[StrategyAgent] Response:', response?.content?.substring(0, 500));
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

標題：${selectedTitle}
目標字數：${input.targetWordCount}

競爭對手優勢：
${topCompetitors.map(c => `- ${c.strengths.slice(0, 2).join('、')}`).join('\n')}

內容缺口：
${topGaps.join('\n')}

**重要規則：**
1. mainSections 最多 4 個
2. 每個 section 的 keyPoints 最多 3 個，每個最多 20 字
3. faq 最多 2 個
4. **只輸出 JSON，不要解釋**

**JSON 格式：**
{
  "introduction": {
    "hook": "開場",
    "context": "背景",
    "thesis": "論點",
    "wordCount": 200
  },
  "mainSections": [
    {
      "heading": "標題",
      "subheadings": ["子標題1"],
      "keyPoints": ["重點1"],
      "targetWordCount": 400,
      "keywords": ["關鍵字1"]
    }
  ],
  "conclusion": {
    "summary": "總結",
    "callToAction": "行動",
    "wordCount": 150
  },
  "faq": [
    {
      "question": "問題",
      "answerOutline": "答案大綱"
    }
  ]
}`;

    try {
      const response = await this.complete(prompt, {
        model: input.model,
        temperature: 0.5,
        maxTokens: 2500,
        format: 'json',
      });

      if (!response.content || response.content.trim() === '') {
        console.warn('[StrategyAgent] Empty outline response, using fallback');
        return this.getFallbackOutline(input.researchData.keyword, input.targetWordCount);
      }

      let content = response.content.trim();
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
      console.error('[StrategyAgent] Response (first 500):', response?.content?.substring(0, 500));
      console.error('[StrategyAgent] Response (last 300):', response?.content?.substring(Math.max(0, (response?.content?.length || 0) - 300)));
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
